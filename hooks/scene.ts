// Stipple Seasons: a wooded slope over a still lake, painted in short dabs of colour.
// One SVG, CSS only. The year runs as one slow CSS timeline: every colour slot fades from season to season,
// and the weather (passing clouds, grey spells, winter snow) rides the same timeline.
// A small orange boat drifts across the lake, left to right, a man fishing in it; now and then he lands one. One wind blows to the left
// through everything: two layers of clouds ride it at their own speeds, ripples flow past each other, gusts pass
// gently over the woods from right to left and bend the reeds in the near corners. Birds cross the sky by day.
// The sun and moon keep the local clock, and the light goes from dawn to day to dusk to night with them; a dark
// window sees the same hour, dimmed.
// Pure string building: no DOM, nothing loaded, the same geometry on every call.

import { dayAt, ramp, type Day } from './day'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']

/** Seconds for one whole year of the scene. */
export const YEAR = 3600
/** Where each season stands fullest on the timeline, as a fraction of the year. */
export const SEASON_CENTER: Record<Season, number> = { spring: 0.09, summer: 0.34, autumn: 0.59, winter: 0.84 }

const W = 1600
const H = 1000
const SHORE = 650
// The canvas reaches past the 1600 by 1000 drawing on every side, so a window of about 1.25 to 1.6 wide
// sees the whole view from a little further back instead of a crop of its middle.
// Z pulls the view back: the canvas grows by Z around the horizon, the land keeps its size (so it looks further away),
// and the sky and lake dabs grow by Z (so their texture looks the same on screen).
const Z = 1.44
/** How much further back than v23 (Z 1.2): what keeps its size on screen (sky, clouds, birds, sun and moon, the near
 * reeds and the things placed in the clear strips) grows by this much in canvas units, and its place moves out with it. */
const ZK = Z / 1.2
const X0 = Math.round(800 - 900 * Z)
const X1 = Math.round(800 + 900 * Z)
const Y0 = Math.round(SHORE - 890 * Z)
const Y1 = Math.round(SHORE + 510 * Z)
/** Where a point of the old 1600 by 1000 layout sits once the view is pulled back. */
const away = (x: number, y: number): [number, number] => [800 + (x - 800) * Z, SHORE + (y - SHORE) * Z]
/** Where a point placed for v23's canvas sits on this one, keeping its place on screen. */
const outX = (x: number) => Math.round(800 + (x - 800) * ZK)
const outY = (y: number) => Math.round(SHORE + (y - SHORE) * ZK)
// The sun and the moon keep the local clock (hooks/day.ts): they rise behind the woods, climb, cross and set when they
// would, at their true height, facing south with east on the left. Across, they are placed by how far through their
// arc they are, not by bearing, because the window covers most of the picture: a sidebar at the left edge, a panel at
// the right, the chat column down the middle. The strips both window shapes leave clear are about x -65 to 115 and
// 1525 to 2010. So a body rises in the left strip and climbs there through its morning, crosses behind the chat in
// the hour or so around its highest, and comes down through its afternoon in the right strip to set there. The sun's
// glitter on the lake is drawn under SUN_X and moved along.
const SUN_X = 1620
/** Where the sun and moon meet the horizon: a little below the treetops, so they rise from behind the woods. */
// (as in v23, about 48 units on screen below the hilltops where they rise and set, so a sun is hidden until it is some
// six degrees up; and as high on screen as v23's at 38 degrees, a November noon)
const HZ = 572
/** Canvas units per degree of height. */
const KY = (HZ - (SHORE + (545 - 38 * 11.5 - SHORE) * ZK)) / 38
/** Where a body is across at each part of its arc: rising, at the end of its morning, at the start of its afternoon,
 * setting. (The sun's disc is 32 across each way: these keep it whole inside both windows' strips.) */
const ARC_X = [-30, 85, 1560, 1900] as const
/** The part of its half arc a body spends crossing behind the chat each side of its highest (an hour or so in all). */
const CROSS = 0.11
/** A body's x from how far through its arc it is (day.ts: -1 rising, 0 highest, 1 setting); straight on a little
 * below the horizon, where it is hidden anyway. */
const skyX = (arc: number) => {
  const [a, b, c, d] = ARC_X
  const u = Math.max(-1.2, Math.min(1.2, arc))
  return u < -CROSS ? a + ((b - a) * (u + 1)) / (1 - CROSS) : u > CROSS ? c + ((d - c) * (u - CROSS)) / (1 - CROSS) : b + ((c - b) * (u + CROSS)) / (2 * CROSS)
}
/** Height on screen for a height in the sky: true up to 30 degrees, then a third as fast, so a body near the top of
 * its arc stays inside the window (a full moon in winter rides to 78 degrees, which was off the top of the picture). */
const skyY = (el: number) => HZ - (el <= 30 ? el : 30 + (el - 30) / 3) * KY
/** Seconds for one round of fishing: waiting, a nibble, lifting the rod, casting again. */
const FISH = 48
/** Rounds of fishing in one pattern: the last of them lands a fish. */
const ROUNDS = 5
// ---------- engine 1: the wind ----------
// One wind blows to the left across the whole picture. Its steady speed carries the clouds, the mist and the near
// ripples, each at a fixed share of it (by how high it rides, and how near the viewer it is, which quickens it on
// screen). Every GUST seconds a gust sweeps the picture from right to left at GUST_FRONT units a second, and reaches
// each thing that bends (the woods band by band, the reeds clump by clump, the water's face, which darkens as it is
// ruffled) when it reaches that thing's x, so the eye sees one gust cross. How strong the gust is over its period is
// one curve, GUST_SHAPE; each thing turns that strength into its own motion with its own amplitude.
/** Canvas units a second the wind carries the high clouds: the other drifts are shares of it. */
const WIND = (X1 - X0) / 520
/** Shares of WIND: the high near clouds, the low far ones, the mist on the water, and the two near ripple layers. */
const DRIFT = { high: 1, low: 0.52, mist: 0.35, ripple: [2, 4 / 3] } as const
/** Seconds a thing riding this share of the wind takes to travel `span` canvas units (the canvas's width unless given). */
const drift = (share: number, span = X1 - X0) => +(span / (WIND * share)).toFixed(2)
/** Canvas units a second the surface water drifts with the wind (what a fish's ring is carried by). */
const SURFACE = WIND * 0.12
/** Seconds from one gust to the next. */
const GUST = 14
/** Canvas units a second a gust's front sweeps leftward: about seven seconds from edge to edge. */
const GUST_FRONT = 360
/** A gust's strength (0 to 1) through its period, [percent, strength]: a first puff, the gust, a lull, a smaller one. */
const GUST_SHAPE: readonly (readonly [number, number])[] = [[0, 0], [12, 0.68], [20, 0.32], [30, 1], [42, 0.21], [56, 0], [70, 0.58], [82, 0.1], [100, 0]]
/** An animation delay that puts the gust where it is at canvas x: the right side has it first. */
const gustDelay = (x: number) => +-(40 + (x - X0) / GUST_FRONT).toFixed(2)
/** Keyframes of the gust's curve, each strength written as declarations by `at`. */
const gustFrames = (name: string, at: (s: number) => string) => timeline(name, 100, GUST_SHAPE.map(([p, s]) => [p, at(s)]))
/** The gust's spatial period: how far apart two gusts are as they cross. */
const GUST_SPAN = GUST_FRONT * GUST
/** Bands across the picture that the gust reaches one after another; each split in two so that neighbouring trees
 * never move as one. */
const GUST_BANDS = 6
const BANDS = Array.from({ length: GUST_BANDS }, (_, k) => k)
/** The middle of a band, for its gust timing. */
const bandX = (k: number) => X0 + ((k + 0.5) * (X1 - X0)) / GUST_BANDS
/** Seconds of the two leaf shimmers in the woods: the wind's small turbulence between gusts. */
const RUSTLE = [GUST * 0.3, GUST * 0.38].map(v => +v.toFixed(1))

// ---------- engine 2: light and shade ----------
// One light over the picture, from the sun's bearing and height (day.ts) by day and, weakly, from the moon by night.
// We look south across the lake, so the light comes from the left (east) in the morning, from ahead around noon and
// from the right (west) in the afternoon; and it is always somewhat behind what we see. What it lights is drawn as a
// few large groups whose opacity follows the light through the 24 hours (nothing inside the tree templates):
// - each near hill has two sheets over it, one for light from the east and one from the west, warm on the faces
//   turned to that light and cool on the faces turned away (read off the hill's outline); they cross-fade over the day;
// - the hills' shade on the water at their feet, thrown toward us and away from the sun, lengthening as it sinks;
// - the boat and the man: a rim of light on the side the light comes from, and the boat's shadow on the water away
//   from it (the same two groups' timing as the sheets);
// - the bellies of the near (high) clouds, warmed from below by a low sun (the far layer's are left out: they are
//   small on screen and each copy re-strokes every belly dab, which shows in the frame cost at dawn and dusk).
// The veil (VEIL, below) gives the overall brightness by the sun's height. Cloud cover (.li) takes the light away.
/** Shade on the water and under the boat. */
const SHADE = '#0b1a33'
/** The rim of light on the boat and the man. */
const RIM = '#ffcf9a'
/** Opacity of the sheets' warm light and cool shade where a face is turned fully to or from the light. */
const FACE_LIT = 0.16
const FACE_SHADE = 0.15
/** The light at a minute: how much comes from the east and from the west across the picture (0 to about 1), from
 * the sun and the moon together, and the sun's own [height, bearing]. */
function lightAt(day: Day, m: number) {
  const [el, az] = day.sun(m)
  const [mel, maz] = day.moon(m)
  const side = (e: number, a: number) => Math.cos(e * DEG) * Math.sin(a * DEG)
  // the sun's light across: how far it comes from the side, once it is clear of the horizon
  const sun = side(el, az) * ramp(el, [[0, 0], [6, 1]])
  // the moon's, weak: by how much of it is lit and how high it is, once the sky is dark
  const lit = (1 - Math.cos(2 * Math.PI * day.phase)) / 2
  const moon = 0.35 * lit * side(mel, maz) * ramp(mel, [[0, 0], [8, 1]]) * ramp(el, [[-8, 1], [-3, 0]])
  return { east: Math.max(0, sun) + Math.max(0, moon), west: Math.max(0, -sun) + Math.max(0, -moon), sun, el, az }
}
/** Each near hill's shade on the water, as a soft oval about the shore under it: [middle x, half width, height]. */
const HILL_SHADE = [[150, 700, 130], [1660, 520, 175]] as const
/** The shade a hill throws on the water at its foot, for the sun at [el, az]: an oval as wide as the hill and as tall,
 * its lower half (the upper is clipped away with the land) squashed to the shade's depth and sheared the way it falls. Seen across a wide lake from near the water, a
 * shade thrown toward us looks short and one thrown sideways long, so it is a band along the shore that deepens and
 * stretches as the sun goes down. (Units: a hill's height on screen; the eye 1/40 of the way across.) */
function shoreShade(el: number, az: number) {
  if (el < 0.5) return 'opacity:0;transform:skewX(0deg) scaleY(0)'
  const q = 1 / (3120 * Math.tan(el * DEG))
  const toward = Math.max(0.05, -Math.cos(az * DEG))
  const near = 1 - Math.min(0.8, 100 * q * toward)
  const depth = Math.min(0.6, (78 * q * toward) / near)
  const across = Math.max(-6, Math.min(6, Math.sin(az * DEG) / (Math.tan(el * DEG) * near)))
  // (a band only a few units deep is left out: in the high sun the shade lies under the trees at the water's edge)
  const o = 0.4 * ramp(el, [[0.5, 0], [2, 1]]) * ramp(depth, [[0.04, 0], [0.07, 1]])
  if (o === 0) return 'opacity:0;transform:skewX(0deg) scaleY(0)'
  return `opacity:${num(o)};transform:skewX(${R(Math.atan2(across, depth) / DEG)}deg) scaleY(${num(depth)})`
}
/** A sheet of light over a hill whose top is f from x0 to x1: warm where its slopes face the light (from the east if
 * `east`), cool where they face away, nothing on the flat. */
function faceSheet(id: string, f: (x: number) => number, x0: number, x1: number, east: boolean) {
  const at: [number, number][] = []
  for (let x = x0; x <= x1; x += 45) {
    // rising to the right (the slope negative on screen) faces east; read over a wide span, so the small unevenness of
    // the outline does not flicker the light
    const face = Math.max(-1, Math.min(1, ((f(x - 150) - f(x + 150)) / 300) * 7)) * (east ? 1 : -1)
    // (nearly flat ground takes neither)
    at.push([(x - x0) / (x1 - x0), Math.abs(face) < 0.3 ? 0 : face])
  }
  // keep the samples a straight run between the kept ones would miss by more than .15
  const keep = [at[0]!]
  for (let i = 1; i < at.length - 1; i++) {
    const [a, b] = [keep[keep.length - 1]!, at[i + 1]!]
    const [o, v] = at[i]!
    if (Math.abs(a[1] + ((b[1] - a[1]) * (o - a[0])) / (b[0] - a[0]) - v) > 0.15) keep.push(at[i]!)
  }
  keep.push(at[at.length - 1]!)
  // (the shade's colour is every stop's, from the gradient's class; the light's stops say so)
  const stop = ([o, v]: [number, number]) => `<stop${v > 0 ? ' class="la"' : ''}${o ? ` offset="${num(o)}"` : ''} stop-opacity="${num(v >= 0 ? FACE_LIT * v : -FACE_SHADE * v)}"/>`
  return `<linearGradient class="lg" id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" x2="${x1}">${keep.map(stop).join('')}</linearGradient>`
}

// Lanes the boat sails in, one crossing each, left to right: the water line it rides. Its size follows the line
// (further off, smaller). It changes lane out of sight, past the right edge, and comes in again from the left, in an
// order that does not look like one.
const LANES = [728, 790, 700, 760, 742, 812] as const
// The middle of the picture is behind the chat column; only the strips at the sides show the lake plainly. So on each
// crossing the boat stops twice, once in each strip, and he fishes there: it comes in from the left, slows and stops
// at the left spot, fishes, rows briskly across the middle, slows and stops at the right spot, fishes, and leaves to
// the right. [left, right] spot of each lane, canvas x, a little different every visit: in the strips that both the
// 1600 and the 2000 wide window leave clear (about 38 to 94, and 1487 to 1859).
const SPOTS = [[62, 1560], [66, 1700], [58, 1620], [64, 1780], [61, 1530], [66, 1660]] as const
/** Seconds the boat stays at a spot: it settles, he casts (5 s), fishes one whole pattern (ROUNDS rounds of FISH
 * seconds, the last a catch) and reels in (4 s). */
const STAY = 5 + FISH * ROUNDS + 4
/** Seconds under way between two spots (or out of the right edge and in from the left to the next lane's spot). */
const MOVE = 51
/** One stay and one move: the fisherman's own timeline runs on this loop, so every stay starts with the same cast.
 * The voyage is a whole number of legs and runs on the same clock, so the boat and the man never drift apart. */
const LEG = STAY + MOVE
const VOYAGE = LANES.length * 2 * LEG
// (v25: four fifths of v24's size, so the boat and the man in it sit further into the picture)
const laneScale = (y: number) => +((0.62 + (y - 700) * 0.0027) * 0.78).toFixed(2)
// Time 0 of the voyage is the boat settling at the left spot of the first lane. Between two stays it moves with the
// default ease-in-out (slow off the spot, quickest in the hidden middle, slow onto the next); on its way out it speeds
// up (ease-in) to the right edge, jumps out of sight to the left edge of the next lane (step-end), and comes in
// slowing down (ease-out) at the same speed. The segment between the two keyframes of a stay is still.
function voyage() {
  const [out, back] = [X1 + 120, X0 - 120]
  const at: [number, string][] = []
  const sizes: [number, string][] = [[0, `scale:${num(laneScale(LANES[0]))}`]]
  const tf = (f: string) => `;animation-timing-function:${f}`
  LANES.forEach((y, j) => {
    const [l, r] = SPOTS[j]!
    const [y2, l2] = [LANES[(j + 1) % LANES.length]!, SPOTS[(j + 1) % LANES.length]![0]]
    const t = j * 2 * LEG
    const to = (x: number, yy: number, more = '') => `translate:${x}px ${yy}px${more}`
    at.push([t, to(l, y)], [t + STAY, to(l, y)], [t + LEG, to(r, y, tf('ease-in'))], [t + LEG + STAY, to(r, y, tf('ease-in'))])
    // out to the right and in from the left at one speed: the move's time shared by the two distances, a second out of sight
    const [dOut, dIn] = [out - r, l2 - back]
    const tOut = ((MOVE - 1) * dOut) / (dOut + dIn)
    const gone = t + LEG + STAY + tOut
    at.push([gone, to(out, y, tf('step-end'))], [gone + 1, to(back, y2, tf('ease-out'))])
    sizes.push([gone + 1, `scale:${num(laneScale(y2))}`])
  })
  at.push([VOYAGE, at[0]![1]])
  sizes.push([VOYAGE, sizes[0]![1]])
  // The size holds for the whole of a lane and changes out of sight, as the boat jumps to the next: its own keyframes,
  // run with step-end on the boat's child (.bx: scale is applied after the parent's translate, before its own eddy
  // transform, which is where it stood on .bt).
  return timeline('voyage', VOYAGE, at, 3) + timeline('lane', VOYAGE, sizes, 3)
}

/** A number as CSS writes it shortest: no leading zero (.5, -.5), no trailing zeros. */
const short = (v: number) => String(+v).replace(/^(-?)0\./, '$1.')
/** A keyframe offset: a percentage to this many places, shortest. */
const pc = (v: number, places: number) => `${short(+v.toFixed(places))}%`
const timeline = (name: string, total: number, points: [number, string][], places = 2) => {
  // the moments that share a value share one rule
  const groups = new Map<string, string[]>()
  for (const [t, v] of points) groups.set(v, [...(groups.get(v) ?? []), pc((t / total) * 100, places)])
  return `@keyframes ${name}{${[...groups].map(([v, at]) => `${at.join(',')}{${v}}`).join('')}}`
}

// ---------- engine 3: the water ----------
// One description of the lake's waves, by depth (0 at the far shore, 1 at the picture's foot): a slow swell running
// left with the wind (its period, its length across and its height, in canvas units), and the texture of the ripples
// that break the light on it (how close the rows are, how long the strokes and the gaps between them, how much they
// tilt), from which the ripple tiles are painted. Whatever floats reads its motion off the same swell at its own x:
// the boat heaves with the water under it and pitches with its slope, a quarter of a swell later; the float, out
// beyond the bow, rides the water there; the reflections waver with it.
/** The swell at a depth. */
const swell = (depth: number) => ({ T: +(7.4 + 3.6 * depth).toFixed(1), L: 140 + 520 * depth, A: 1 + 2.5 * depth })
/** The ripples' texture at a depth (canvas units): the gap between rows, the shortest stroke and how much longer one
 * may be, the shortest gap and how much longer, and the most a stroke tilts. */
const rippleAt = (depth: number) => ({
  row: (5 + 9.5 * depth) * Z,
  dab: [(5 + 8 * depth) * Z, (7 + 29 * depth) * Z],
  gap: [(4.6 + 5.4 * depth) * Z, (5.4 + 8.6 * depth) * Z],
  tilt: 0.4 + 1.2 * depth,
})
/** The far ripple layers sway to and fro with the far swell, a little slower than it and out of step with each other;
 * glints come and go at fractions of the swell under the sun (seconds of each swing). */
const FAR_SWAY = [1.4, 1.8].map(k => +(swell(0.1).T * k).toFixed(1))
const GLINT = [0.3, 0.4].map(k => +(swell(0.2).T * k).toFixed(1))
/** An animation delay that puts the swell's phase where it is at canvas x (the right side has each crest first, as
 * the swell runs left), for a motion of the swell's period T. */
const swellDelay = (x: number, w: { T: number; L: number }) => +-(((x - X0) / w.L) * w.T % w.T + w.T).toFixed(2)
/** The boat's water: the swell at the depth of its lanes, and how large the boat is drawn there (its own units). */
const BOAT_SWELL = swell((LANES.reduce((a, b) => a + b, 0) / LANES.length - SHORE) / (Y1 - SHORE))
/** How the boat rides it, in the boat's own units (it is drawn about this much smaller than the canvas): it heaves as
 * high as the swell, pitches as steeply as its slope, and its float rides the water FLOAT[0] ahead of the bow. */
function boatOnSwell() {
  const k0 = 0.54
  const { T, L, A } = BOAT_SWELL
  const [a, l] = [A / k0, L / k0]
  const k = (2 * Math.PI) / l
  const pitch = Math.atan(a * k) / DEG
  // The float's motion over what the boat already gives it (the heave, and the pitch's lift at its distance): the
  // water there minus the boat's, a swell of its own, `phase` ahead of the boat's heave.
  const kd = k * FLOAT[0]
  const [u, v] = [Math.cos(kd) - 1, Math.sin(kd) - kd]
  const float = a * Math.hypot(u, v)
  const phase = Math.atan2(v, u)
  // the line, and the float on it, stand turned by the line's angle at rest: the bob is turned back to upright
  const t = AT_REST.line * DEG
  const up = (c: number) => `translate(${num(c * Math.sin(t))}px,${num(c * Math.cos(t))}px)`
  // each motion an ease-in-out swing (alternate) over half the swell; the heave starts in a trough
  const d = swellDelay(SPOTS[0][0], BOAT_SWELL)
  const at = (shift: number) => short(+(d - T + (((shift % 1) + 1) % 1) * T).toFixed(2))
  return `.bb{animation:heave ${T / 2}s ease-in-out ${at(0)}s infinite alternate}@keyframes heave{from{transform:translateY(${num(a)}px)}to{transform:translateY(${num(-a)}px)}}
.by{transform-origin:0 6px;animation:roll ${T / 2}s ease-in-out ${at(0.25)}s infinite alternate}@keyframes roll{from{transform:rotate(${num(-pitch)}deg)}to{transform:rotate(${num(pitch)}deg)}}
.fb{animation:fb ${T / 2}s ease-in-out ${at(-phase / (2 * Math.PI))}s infinite alternate}@keyframes fb{from{transform:${up(float)}}to{transform:${up(-float)}}}
.wr{animation:waver ${T / 2}s ease-in-out ${at(0.25)}s infinite alternate}@keyframes waver{from{transform:translate(${num(-2 * pitch / 2.4)}px,-1px)}to{transform:translate(${num(2 * pitch / 2.4)}px,1px)}}`
}

// ---------- the fisherman ----------
// He sits on the thwart facing the bow (right), knees up, the rod held low in both hands across his knee. Every joint
// is a group turning about its pivot: the body at the hips, the near arm at the shoulder and the elbow (the rod rides
// in that hand), the far arm at its shoulder and elbow, and the rod bends in three joints along it. The line hangs
// from the rod tip in a group of its own that is turned and stretched so that its end is always where the float, the
// hook or the fish should be: every pose below names those places, and the angles that put them there are worked out
// here, so the joints, the line and the float stay together in every frame.
type Pt = readonly [number, number]
type Mx = readonly [number, number, number, number, number, number]
const mul = (m: Mx, n: Mx): Mx => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
/** A turn of `deg` degrees about the point p, as SVG and CSS turn (clockwise on screen). */
const turn = ([x, y]: Pt, deg: number): Mx => {
  const a = (deg * Math.PI) / 180
  const [c, s] = [Math.cos(a), Math.sin(a)]
  return [c, s, -s, c, x - c * x + s * y, y - s * x - c * y]
}
const apply = (m: Mx, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
const toward = ([x, y]: Pt, rad: number, d: number): Pt => [x + d * Math.cos(rad), y + d * Math.sin(rad)]
const DEG = Math.PI / 180
const HIP: Pt = [-12, -1]
const SHOULDER: Pt = [-8, -17]
const ELBOW: Pt = [-2, -11.5]
const HAND: Pt = [5.5, -12.5]
const ROD = -28 * DEG
/** Where along the rod (from the near hand) its three bending joints and its tip are. */
const ROD_AT = [20, 36, 49, 60] as const
const rodPt = (d: number) => toward(HAND, ROD, d)
const FAR_SHOULDER: Pt = [-9.5, -17]
/** Upper arm and forearm of the far arm, each. */
const ARM = 8.6
/** Where the float rides while he waits: on the water off the bow. */
const FLOAT: Pt = [84, 5]
/** The far arm's two angles (upper arm, forearm, radians) that put its hand at p, in the body's own frame. */
const reach = ([x, y]: Pt): [number, number] => {
  const [dx, dy] = [x - FAR_SHOULDER[0], y - FAR_SHOULDER[1]]
  const k = Math.acos(Math.min(Math.hypot(dx, dy), 2 * ARM - 0.01) / (2 * ARM))
  const base = Math.atan2(dy, dx)
  return [base + k, base - k]
}
const FAR_REST = reach(rodPt(4))
const FAR_ELBOW = toward(FAR_SHOULDER, FAR_REST[0], ARM)
const FAR_HAND = toward(FAR_ELBOW, FAR_REST[1], ARM)

/** A pose: the body's lean T, the near shoulder A and elbow E, the rod's bend B at each of its joints (degrees, plus
 * leans forward or lifts down); where the line ends (a point, 'hang' below the tip, or 'hand': in the far hand);
 * where the far hand is (on the rod, or a point); how slack the line is (1 slack, 0 taut); whether a fish is on; and
 * how far a bite pulls the float under, along the line (d). */
type Pose = { T: number; A: number; E: number; B: number; L: Pt | 'hang' | 'hand'; H: Pt | 'rod'; s: number; f: number; d: number }
const REST: Pose = { T: 0, A: 0, E: 0, B: 0, L: FLOAT, H: 'rod', s: 1, f: 0, d: 0 }
/** The pose's joints and line, as the values the keyframes carry. */
function solve(p: Pose) {
  const body = turn(HIP, p.T)
  const fore = mul(mul(body, turn(SHOULDER, p.A)), turn(ELBOW, p.E))
  let rod = fore
  for (const d of ROD_AT.slice(0, 3)) rod = mul(rod, turn(rodPt(d), p.B))
  const tip = apply(rod, rodPt(60))
  const aim = p.H === 'rod' ? apply(fore, rodPt(4)) : p.H
  const [u, v] = reach(apply(turn(HIP, -p.T), aim))
  const hand = apply(body, toward(toward(FAR_SHOULDER, u, ARM), v, ARM))
  const end = p.L === 'hang' ? ([tip[0] + 3, tip[1] + 16] as Pt) : p.L === 'hand' ? hand : p.L
  return {
    tip,
    line: Math.atan2(end[1] - tip[1], end[0] - tip[0]) / DEG - (p.T + p.A + p.E + 3 * p.B),
    far: [(u - FAR_REST[0]) / DEG, (v - u - (FAR_REST[1] - FAR_REST[0])) / DEG],
    long: Math.hypot(end[0] - tip[0], end[1] - tip[1]),
  }
}
const AT_REST = solve(REST)
/** The line's length at rest, to a whole unit: the float rides at its end. */
const LINE = Math.round(AT_REST.long)

/** He holds the rod upright, the line reeled in to a short end under the tip, while the boat is under way. */
const TRAVEL: Pose = { T: 0, A: -8, E: -52, B: 0, L: 'hang', H: 'rod', s: 0, f: 0, d: 0 }
/** Seconds into a leg that the pattern starts: the boat has settled and he has cast. */
const CAST = 5
/** A leg (see LEG): the boat settles at a spot with the line in; he casts and fishes one pattern of ROUNDS rounds of FISH
 * seconds, the moments of which follow (shifted by CAST); he reels in, and holds the rod upright while the boat moves on.
 * Mostly he sits and watches the float; a bite that comes to nothing; a strike that misses, the hook checked and cast
 * again; and in the last round a fish, played, drawn in, taken in the free hand, put down in the boat, the hook baited
 * and cast again. */
function fishingMoments(): [number, Partial<Pose>][] {
  const m: [number, Partial<Pose>][] = [[0, TRAVEL]]
  const lean = { T: 4, A: -2, E: -1 }
  const nibble = (t: number, deep: number) => {
    m.push([t, { d: 1.4 * deep }], [t + 0.4, { d: 0 }], [t + 1, { d: 2.2 * deep }], [t + 1.5, { d: 0 }])
  }
  // the hook back to his hand, the bait seen to, and a cast: rod back over his shoulder, a flick, the float out
  const cast = (t: number) => {
    m.push(
      [t, { T: -4, A: -14, E: -58, B: 0, L: 'hang', H: 'rod', s: 0 }],
      [t + 0.8, { T: -5, A: -16, E: -68 }],
      [t + 1.3, { T: 4, A: -2, E: 6, B: 1.5, L: [66, -30] }],
      [t + 1.8, { T: 2, A: 0, E: 2, B: 0, L: FLOAT }],
      [t + 2.3, { s: 1 }],
      [t + 4, REST],
    )
  }
  cast(1)
  for (let r = 0; r < ROUNDS; r++) {
    const o = CAST + r * FISH
    const kind = r === ROUNDS - 1 ? 'catch' : (['wait', 'bite', 'miss', 'wait'] as const)[r % 4]!
    if (kind === 'wait') {
      // he lifts the tip a touch and lets it down; later he shifts on the thwart
      m.push([o + 13, REST], [o + 14.4, { E: -4 }], [o + 16, { E: -4 }], [o + 17.6, { E: 0 }])
      m.push([o + 31, REST], [o + 33, { T: 2.5, A: -1.5 }], [o + 37, { T: 2.5, A: -1.5 }], [o + 39, REST])
    } else if (kind === 'bite') {
      m.push([o + 19, REST], [o + 20.4, lean])
      nibble(o + 21, 1)
      nibble(o + 24, 0.7)
      m.push([o + 29, lean], [o + 31, REST])
    } else if (kind === 'miss') {
      m.push([o + 20, REST], [o + 21.2, lean])
      nibble(o + 21.6, 1)
      m.push(
        [o + 23.4, { ...lean, d: 2.6 }],
        [o + 24, { T: -6, A: -18, E: -22, B: 2, L: 'hang', s: 0, d: 0 }],
        [o + 25, { T: -5, A: -16, E: -20, B: 0 }],
        // nothing on: he swings the hook in and takes it in his free hand
        [o + 26.4, { T: 0, A: -12, E: -34, H: [10, -20], L: 'hand' }],
        [o + 28, { T: 1.5, A: -10, E: -32, H: [9, -17] }],
        [o + 30, { H: [10, -18] }],
      )
      cast(o + 31)
    } else {
      m.push([o + 15, REST], [o + 16.2, lean])
      nibble(o + 16.6, 0.8)
      nibble(o + 19.6, 1)
      m.push(
        [o + 21.4, { ...lean, d: 3 }],
        // the strike: he sits back, the rod sweeps up and bends, the line goes taut
        [o + 22, { T: -7, A: -20, E: -22, B: 4, L: [80, 2], s: 0, d: 0 }],
        [o + 22.6, { B: 6 }], [o + 23.2, { B: 4, L: [77, 6] }], [o + 23.8, { B: 6.5 }], [o + 24.4, { B: 4.5, L: [72, 4] }],
        [o + 25, { B: 6, L: [69, 6] }], [o + 25.6, { B: 4.5, L: [64, 5] }], [o + 26.2, { B: 5.5, L: [60, 6] }],
        // the fish breaks the water and is drawn in, swinging toward the boat
        [o + 26.8, { T: -8, A: -24, E: -30, B: 4.5, L: [54, 1], f: 1 }],
        [o + 28, { T: -9, A: -27, E: -42, B: 4, L: [32, -14] }],
        [o + 29, { L: [18, -18] }],
        // he takes it in his free hand, leans and puts it down in the boat
        [o + 29.8, { T: -4, A: -22, E: -38, B: 2, H: [16, -19], L: 'hand' }],
        [o + 31, { T: 7, A: -6, E: -12, B: 0, H: [6, 0] }],
        [o + 31.6, { f: 0 }],
        // and sits up, baits the hook at his chest
        [o + 33.2, { T: 1.5, A: -10, E: -32, H: [9, -17] }],
        [o + 35.2, { H: [10, -18] }],
      )
      cast(o + 36)
    }
  }
  // the pattern ends as it began, at rest; he reels in, the float lifted from the water to the rod's tip
  const done = CAST + ROUNDS * FISH
  m.push([done, REST], [done + 2, { A: -4, E: -28, L: 'hang', s: 0 }], [STAY, TRAVEL], [LEG, TRAVEL])
  return m
}

/** The keyframes for every joint and the line over one pattern, and the rings the float makes. */
function fishing() {
  const total = LEG
  let pose = REST
  const lists: Record<string, [number, string][]> = { pt: [], pa: [], pf: [], pr: [], pu: [], pv: [], pl: [], pk: [], pe: [], pb: [], ps: [], pq: [], fh: [] }
  const deg = (v: number) => `rotate:${R(v)}deg`
  let line = AT_REST.line
  for (const [t, change] of fishingMoments()) {
    pose = { ...pose, ...change }
    const s = solve(pose)
    // the line's turn taken the short way round from the last
    let a = s.line
    while (a - line > 180) a -= 360
    while (line - a > 180) a += 360
    line = a
    const v: Record<string, string> = {
      pt: deg(pose.T), pa: deg(pose.A), pf: deg(pose.E), pr: `rotate:${num(pose.B)}deg`, pu: deg(s.far[0]!), pv: deg(s.far[1]!),
      // the float a whole unit at a time, the line stretched to meet it
      pl: deg(a - AT_REST.line), pk: `scale:${num3(R(s.long) / LINE)} 1`, pe: `translate:${R(s.long) - LINE}px`,
      pb: `scale:${num3(1 + pose.d / LINE)} 1`,
      ps: `opacity:${num(0.85 * pose.s)}`, pq: `opacity:${num(0.85 * (1 - pose.s))}`, fh: `opacity:${pose.f}`,
    }
    for (const k in lists) lists[k]!.push([t, v[k]!])
  }
  const ring: [number, string][] = []
  const rg = (t: number, o: number, k: number) => ring.push([t, `opacity:${short(o)};transform:scale(${short(k)})`])
  rg(0, 0, 0.4)
  // a wide ring where the first cast of a stay lands
  rg(2.6, 0, 0.4), rg(3.1, 0.8, 0.7), rg(5.8, 0, 2.6)
  for (let r = 0; r < ROUNDS; r++) {
    const o = CAST + r * FISH
    // a small ring at each bite, a wider one where the float lands
    const at = [[], [21, 24], [21.6, 32.8], [], [16.6, 19.6, 22, 37.8]][r] ?? []
    for (const t of at) rg(o + t - 0.2, 0, 0.4), rg(o + t + 0.3, 0.8, 0.7), rg(o + t + 3, 0, 2.6)
  }
  rg(total, 0, 0.4)
  let css = timeline('ring1', total, ring)
  // the wake only while the boat is under way
  // the paddling arm in place of the far arm while under way
  const swap = (a: string, b: string): [number, string][] => [[0, a], [STAY + 1, a], [STAY + 1.6, b], [LEG - 2, b], [LEG - 1.4, a], [LEG, a]]
  css += timeline('py', total, swap('opacity:0', 'opacity:1')) + timeline('pz', total, swap('opacity:1', 'opacity:0'))
  css += timeline('wk', total, [[0, 'opacity:0'], [STAY, 'opacity:0'], [STAY + 10, 'opacity:.45'], [LEG - 9, 'opacity:.45'], [LEG, 'opacity:0']])
  for (const [k, stops] of Object.entries(lists)) {
    // a stop between two equal ones changes nothing
    const kept = stops.filter(([, v], i) => i === 0 || i === stops.length - 1 || v !== stops[i - 1]![1] || v !== stops[i + 1]![1])
    css += timeline(k, total, kept, 1)
  }
  return css
}

const num3 = (v: number) => String(+v.toFixed(3)).replace(/^0\./, '.')
const stroke = (c: string, w: number, d: string, more = '') => `<path stroke="${c}" stroke-width="${w}"${more} d="${d}"/>`
const pt = ([x, y]: Pt) => pair(+num(+x.toFixed(1)), +num(+y.toFixed(1))).replace(/(^|[ -])0\./g, '$1.')
/** A group turning about p, with this class. */
const joint = (cls: string, [x, y]: Pt, inner: string, more = '') =>
  `<g class="${cls}" style="transform-origin:${num(x)}px ${num(y)}px"${more}>${inner}</g>`

// A fisherman sits in a small boat that drifts very slowly, painted in short strokes as the rest of the picture is.
// He watches his float; now and then a fish nibbles (the float dips and rings spread), he leans in, strikes, plays it
// and lands it, or misses and casts again. The boat's broken reflection wavers under it, a faint wake behind.
function boat() {
  const jacket = '#2c3d5c'
  const [j1, j2, j3] = [rodPt(ROD_AT[0]), rodPt(ROD_AT[1]), rodPt(ROD_AT[2])]
  const tip = rodPt(60)
  const lineTo = LINE
  // the line from the tip, turned to the float and stretched as the moment asks: slack (a sag) or taut (straight)
  const lineAngle = num(+AT_REST.line.toFixed(2))
  const line = `<g transform="translate(${pt(tip)})"><g class="pl" transform="rotate(${lineAngle})"><g class="pb"><g class="pk">${stroke('#e9eef2', 0.9, `M0 0Q${num(lineTo / 2)} 7 ${num(+lineTo.toFixed(1))} 0`, ' class="ln ps"')}${stroke('#e9eef2', 0.9, `M0 0H${num(+lineTo.toFixed(1))}`, ' class="ln pq"')}</g><g class="pe" transform="translate(${num(+lineTo.toFixed(1))})"><g class="fh"><g class="fw">${stroke('#c3ced2', 4.2, 'M2.6 0h7.4')}${stroke('#7f949a', 1.3, 'M3-1.2h6.4')}${stroke('#eef2f2', 1.2, 'M3.6 1.1h5')}<path fill="#8fa3a8" d="M11 0l3.2-2.4v4.8z"/></g></g><g class="fb">${stroke('#fafafa', 1.4, 'M-2.2 0h.4')}${stroke('#e04a2c', 2.4, 'M-.8 0h1.4')}</g></g></g></g></g>`
  const rod = stroke('#4a321e', 2.2, `M${pt(rodPt(-4))}L${pt(j1)}`) + joint('pr', j1, stroke('#5b3f26', 1.6, `M${pt(j1)}L${pt(j2)}`) + joint('pr', j2, stroke('#5b3f26', 1.25, `M${pt(j2)}L${pt(j3)}`) + joint('pr', j3, stroke('#6a4a2c', 0.95, `M${pt(j3)}L${pt(tip)}`) + line)))
  const far = '<g class="pz">' + joint('pu', FAR_SHOULDER, stroke('#1d2840', 3, `M${pt(FAR_SHOULDER)}L${pt(FAR_ELBOW)}`) + joint('pv', FAR_ELBOW, stroke('#1d2840', 2.6, `M${pt(FAR_ELBOW)}L${pt(FAR_HAND)}`) + stroke('#c99a76', 2.6, `M${pt(FAR_HAND)}l.6-.3`))) + '</g>'
  // under way, his free arm paddles on the far side: a slow two-beat stroke (.pw), shown only while the boat moves (.py)
  const paddle = `<g class="py"><g class="pw" style="transform-origin:-9.5px -17px">${stroke('#6a4a2c', 1.3, 'M4-18L9 6')}${stroke('#5b3f26', 3, 'M8.4 3l.6 5')}${stroke('#1d2840', 3, 'M-9.5-17L-2-13')}${stroke('#1d2840', 2.6, 'M-2-13L6-11')}${stroke('#c99a76', 2.6, 'M6-11l.6-.3')}</g></g>`
  const body = `<g class="rw">${stroke(jacket, 7, 'M-11.5-3Q-12.5-11-8.5-16')}${stroke('#1d2840', 2.6, 'M-15-4Q-16-12-11.5-18')}${stroke('#3d527a', 2, 'M-8-5Q-7-10-5.6-14')}<g class="le">${stroke('#8aa0c4', 1.3, 'M-15.4-6Q-16.2-12-12-17.6')}</g><g class="lw">${stroke('#8aa0c4', 1.2, 'M-7.6-6Q-6.8-10-5.4-13.6')}</g>${stroke('#5a76a4', 2.4, 'M-10.6-18.6Q-7.6-19.6-4.8-17.4')}${stroke('#b98a68', 2.6, 'M-6.6-19.4l1-.8')}<g class="hd">${stroke('#e8c29e', 4.6, 'M-4.6-22.6l1.2.4')}${stroke('#b98a68', 2, 'M-7-22.2l.4 1')}${stroke('#d9b45a', 4.4, 'M-7.6-26.4l4.2-.2')}${stroke('#f6e09a', 1.8, 'M-5.6-28l2.6.3')}${stroke('#e6c46a', 1.8, 'M-11.6-24.8Q-5-26.4 1.6-24.2')}${stroke('#7a5c30', 1.3, 'M-8.4-23.5Q-4-24.3-.6-23.1')}</g></g>`
  const legs = `${stroke('#3a3c48', 4.6, 'M-12-1.5Q-6-8-.5-9.6')}${stroke('#59607a', 2, 'M-3.4-10l2.4-.5')}${stroke('#34363f', 3.8, 'M.5-9.2L3-1')}`
  const arm = joint('pa', SHOULDER, `${stroke(jacket, 3.6, 'M-8-17Q-5.5-13.5-2-11.5')}${stroke('#5a76a4', 1.3, 'M-7-18Q-4.6-15.6-1.6-12.8')}${joint('pf', ELBOW, `${stroke(jacket, 3.2, `M-2-11.5L${pt(toward(HAND, Math.PI, 0.8))}`)}${rod}${stroke('#e8c29e', 2.8, `M${pt(HAND)}l1-.3`)}`)}`)
  const man = `${joint('pt', HIP, far + paddle + body)}${legs}${joint('pt', HIP, arm)}`
  const hull = `<path fill="#c24e26" d="M-46-4Q-30 12 0 12Q32 12 48-6Q0 4-46-4z"/>${stroke('#8a3218', 3.4, 'M-30 7.4Q0 12.6 32 5')}${stroke('#d8642f', 2.6, 'M-36 1.8Q-20 6-6 6.4M8 6Q24 5 36 .8')}${stroke('#f08a4a', 2, 'M-44.6-3.6Q0 3.4 46.6-5.4')}${stroke('#ffb070', 1.2, 'M30-1.4l9-2')}`
  const ring = (c: string) => `<ellipse class="${c}" cx="${FLOAT[0]}" cy="${FLOAT[1] + 2}" rx="7" ry="2"/>`
  // under the hull: a soft dark touch at the waterline, the broken reflection of the boat and the man, and a faint wake
  // (its shadow on the water, away from the light: to the right in the light from the east, to the left in the west's)
  const under = `${(['le', 'lw'] as const).map((c, i) => `<g class="${c}"><ellipse cx="${i ? -16 : 16}" cy="13" rx="40" ry="3.4" fill="${SHADE}" opacity=".4"/></g>`).join('')}${stroke('#0b1a33', 2.6, 'M-36 10Q0 15.6 38 8', ' opacity=".3"')}<g class="wr" opacity=".5">${stroke('#b8582e', 2.4, 'M-36 14.4h20M-10 15.8h24M20 13.8h15')}${stroke(jacket, 2.2, 'M-15 19.5h8M-10.5 22.6h3', ' opacity=".8"')}${stroke('#c9b070', 1.4, 'M-12 27h6', ' opacity=".7"')}</g><g class="wk" opacity=".45">${stroke('#e4eef2', 1.2, 'M-52 9l-16 1.4M-74 10.8l-9 .5', ' class="h0"')}${stroke('#e4eef2', 1.1, 'M-56 5.6l-21-1', ' class="h1"')}</g>`
  return `<g class="bt"><g class="bx"><g class="bb">${under}<g class="by">${stroke('#6e2a14', 3, 'M-38-3.2Q0-6 40-5')}${man}${hull}<g class="le">${stroke(RIM, 1.5, 'M-44-3.2Q-28 .8-10 2.4')}</g><g class="lw">${stroke(RIM, 1.5, 'M10 2.2Q28 .6 46-5.2')}</g></g>${ring('r1')}<g class="ps">${ring('r2')}</g></g></g></g>`
}

type Four = readonly [string, string, string, string]

// ---------- colour ----------

const hex = (c: string): [number, number, number] => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
]
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
const NIGHT = '#0a1430'

/** Each slot: its four season colours by day, and by night (derived unless given). */
type Slot = { day: Four; night?: Four; prop: 'stroke' | 'fill' | 'stop-color' }

const SLOTS: Record<string, Slot> = {
  // sky dabs, top to horizon
  q1: { prop: 'stop-color', day: ['#9dbde0', '#79aade', '#a2b0d2', '#b6c2d2'], night: ['#0f1a40', '#0d1a44', '#13193d', '#161e3e'] },
  q2: { prop: 'stop-color', day: ['#bfd5ec', '#a9cdec', '#c4c8de', '#cdd5df'], night: ['#1a2a58', '#17295c', '#1e2652', '#212a50'] },
  q3: { prop: 'stop-color', day: ['#ebe8e0', '#dcecf3', '#f0dcc0', '#eaedf0'], night: ['#2f4274', '#2b4178', '#353a68', '#37416a'] },
  sf: { prop: 'fill', day: ['#fff3d0', '#fffae2', '#ffdca8', '#f8f4ea'], night: ['#f1ead0', '#f4eed6', '#f3e2bd', '#eef0f2'] },
  // sun by day, moon by night
  su: { prop: 'stroke', day: ['#fff0c4', '#fff7d6', '#ffd49a', '#f6f1e4'], night: ['#f1ead0', '#f4eed6', '#f3e2bd', '#eef0f2'] },
  // clouds: lit tops and shaded bellies
  cl: { prop: 'stroke', day: ['#f7f7f4', '#ffffff', '#f6ece0', '#eef1f4'], night: ['#4a5684', '#4a5888', '#4e5480', '#55608a'] },
  cf: { prop: 'fill', day: ['#f3f4f2', '#fbfcfc', '#f3ebe2', '#e9edf1'], night: ['#3e4a78', '#3e4c7c', '#424874', '#48537e'] },
  cs: { prop: 'stroke', day: ['#c7d1dc', '#c4d2e2', '#cdc6c8', '#bfc7d1'], night: ['#28325a', '#27345e', '#2b3058', '#2e3760'] },
  // far ridge
  fr: { prop: 'fill', day: ['#93a8c4', '#839ec2', '#a0a3c0', '#a4afc2'] },
  fd: { prop: 'stroke', day: ['#7a92b6', '#6a8bb4', '#8a8cb0', '#8a98b0'] },
  f2: { prop: 'stroke', day: ['#a2b5cf', '#90abcc', '#b0aac6', '#b7c2d2'] },
  f3: { prop: 'stroke', day: ['#c4d0e0', '#b2c4da', '#d2c4cc', '#f5f7f9'] },
  // a farther ridge behind it, half lost in the haze of the sky
  fz: { prop: 'fill', day: ['#b7c4d8', '#a9bfd8', '#bcb7cc', '#c4cdd9'] },
  // ground under the woods
  gr: { prop: 'fill', day: ['#3e6a42', '#2c5534', '#6e4a2e', '#dbe3ee'] },
  // the shade at the foot of the near woods: dark green, a cool blue on the snow in winter
  qf: { prop: 'stop-color', day: ['#14301c', '#14301c', '#14301c', '#46608c'] },
  // broadleaf crowns: shadow, body, light (blossom in spring, gold in autumn). In winter the crowns are bare and
  // laden with snow: warm grey and blue-white, the dark twigs (t1) showing only here and there on the shaded side;
  // t4 is the rest of the shade, the same as t1 until winter, when it is snow in shadow.
  t1: { prop: 'stroke', day: ['#4b7a47', '#2b5a36', '#8e3a22', '#4a3c35'] },
  t4: { prop: 'stroke', day: ['#4b7a47', '#2b5a36', '#8e3a22', '#9da2b0'] },
  t2: { prop: 'stroke', day: ['#86bb5e', '#4a8742', '#d6732a', '#c4bcb5'] },
  t3: { prop: 'stroke', day: ['#f3b6c6', '#8fc25a', '#f2c24a', '#f4f7fb'] },
  // conifers stay green, white-capped in winter
  c1: { prop: 'stroke', day: ['#24463a', '#1f4136', '#28473b', '#173328'] },
  c2: { prop: 'stroke', day: ['#3b674c', '#305d46', '#3a5f48', '#284a3a'] },
  c3: { prop: 'stroke', day: ['#6c9a60', '#588a52', '#6c8756', '#eef2f6'] },
  // shore: grass and sand, snow in winter
  g1: { prop: 'stroke', day: ['#79a556', '#5b8b3e', '#a3893f', '#e8eef4'] },
  // reeds near the viewer: stalks, blades, and plumes (purple-brown young plumes in spring and summer, mauve-cream in
  // autumn, silver in winter); the reeds stand through the winter, dry and straw-coloured
  e1: { prop: 'stroke', day: ['#7da25a', '#5d8a42', '#c2a564', '#b39566'] },
  e3: { prop: 'stroke', day: ['#5f8f44', '#3f7536', '#a88a4c', '#9a8460'] },
  // the thin, lit stalks and the narrow leaves: lighter and warmer, a broken colour among the others
  ew: { prop: 'stroke', day: ['#a3bf6a', '#86ad55', '#dcc27e', '#d0b98a'] },
  e2: { prop: 'stroke', day: ['#7a5250', '#6c4748', '#ddd0c0', '#d2cdc4'] },
  g2: { prop: 'stroke', day: ['#cdc28a', '#bfae70', '#caa060', '#cdd7e2'] },
  // water: base, deep dabs, mid dabs, glints
  wa: { prop: 'fill', day: ['#6e9cc2', '#4c8cc2', '#5f82a6', '#8aa2b8'], night: ['#0f1c44', '#0d1c48', '#111b40', '#152042'] },
  w1: { prop: 'stroke', day: ['#4d7eae', '#2e6da8', '#3e648e', '#6d88a2'], night: ['#0a1534', '#081538', '#0c1532', '#101a36'] },
  w2: { prop: 'stroke', day: ['#8bb6d6', '#6aa8da', '#86a5c2', '#b2c4d4'], night: ['#22336a', '#1f346e', '#252f62', '#2a3766'] },
  w3: { prop: 'stroke', day: ['#e4eef2', '#dcedf6', '#f2d8ae', '#f2f5f8'], night: ['#c9c6ae', '#d2cfb6', '#cdbb98', '#d6dae2'] },
  // a few strokes of the opposite colour, as a pointillist puts them: muted violet in the deep water, pale warm in the lit
  w4: { prop: 'stroke', day: ['#6b6c9e', '#5d64a2', '#6c6690', '#8a8daa'] },
  w5: { prop: 'stroke', day: ['#d9d5c4', '#d6d6c4', '#e2d0b2', '#e0ddd6'] },
  // v37: the light side of the reeds' heads; lily pads by the reeds (young in spring, full in summer, floating gold
  // leaves in autumn, thin plates of ice in winter), the light on them, and summer's flowers (the light in other seasons)
  e4: { prop: 'stroke', day: ['#c09a86', '#aa827a', '#fff2d2', '#ffffff'] },
  lp: { prop: 'fill', day: ['#6b9a49', '#3f7a38', '#b0843c', '#c6d2dd'] },
  lh: { prop: 'stroke', day: ['#a8d07c', '#80b65c', '#dcb062', '#f2f6fa'] },
  lf: { prop: 'stroke', day: ['#a8d07c', '#f6b3c8', '#dcb062', '#f2f6fa'] },
}

/** The seasons' plateaus and turns over the year: [fraction of the year, season index]. */
const STOPS: readonly [number, number][] = [
  [0, 0], [0.18, 0], [0.25, 1], [0.43, 1], [0.5, 2], [0.68, 2], [0.75, 3], [0.93, 3], [1, 0],
]
/** The colour a slot shows at a point of the year, matching its keyframes. */
const colourAt = (f: Four, at: number) => {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, s0] = STOPS[i]!
    const [p1, s1] = STOPS[i + 1]!
    if (at >= p0 && at <= p1) {
      return mix(f[s0]!, f[s1]!, p1 === p0 ? 0 : (at - p0) / (p1 - p0))
    }
  }
  return f[0]
}
/** A colour in as few characters as it takes: #aabbcc as #abc. */
const shortHex = (c: string) => (/^#(\w)\1(\w)\2(\w)\3$/.test(c) ? `#${c[1]}${c[3]}${c[5]}` : c)
// The year's colours run on the root alone. Each slot names its four season colours (--a .. --d) and paints
// SEASON_MIX, a blend of them weighted by three percentages the root hands down: --p (spring to summer), --q (autumn
// to winter) and --r (the first pair to the second). Only one of them moves at a time, the others resting where they
// have no weight. A custom property animates in steps, so each turn of the seasons is TURN_STEPS small steps (one
// every ten seconds or so of a 3600 s year). One animation on one element instead of one on every stroke of every
// copied tree and tile: the frame no longer restyles a thousand strokes each tick, only all of them every few seconds.
// The gradients' stops are the exception: a stop's colour given as a blend of custom properties makes Chromium rebuild
// the gradient (and repaint all it fills) every frame, so the few stops (q1 .. qf) keep keyframes of their own (yc).
const SEASON_MIX = 'color-mix(in srgb,color-mix(in srgb,var(--d) var(--q),var(--c)) var(--r),color-mix(in srgb,var(--b) var(--p),var(--a)))'
const TURN_STEPS = 25
/** The weights [p, q, r] at a point of the year (0 to 1), in percent: spring p0 r0, summer p100 q0 r0, autumn q0 r100, winter p0 q100 r100. */
const seasonWeights = (at: number) => {
  let i = 0
  while (i < STOPS.length - 2 && at > STOPS[i + 1]![0]) i++
  const [p0, s0] = STOPS[i]!
  const [p1, s1] = STOPS[i + 1]!
  const f = p1 === p0 || s0 === s1 ? 0 : Math.max(0, Math.min(1, (at - p0) / (p1 - p0)))
  const state = (s: number) => [[0, 100, 0], [100, 0, 0], [100, 0, 100], [0, 100, 100]][s]!
  // between two seasons only the weight that tells them apart moves
  const [a, b] = [state(s0), state(s1)]
  const w = a.map((v, k) => (s0 === s1 ? v : k === [0, 2, 1, 2][s0] ? v + (b[k]! - v) * f : v))
  return w.map(v => +v.toFixed(1)) as [number, number, number]
}
/** The root's keyframes: each weight given only where it moves, in TURN_STEPS steps, and where it must rest. */
function seasonKeyframes() {
  const frames = new Map<number, string[]>()
  const put = (pct: number, name: string, v: number) => {
    const at = +pct.toFixed(2)
    frames.set(at, [...(frames.get(at) ?? []), `--${name}:${R(v)}%`])
  }
  const turn = (name: string, from: number, to: number, start: number) => {
    for (let k = 0; k <= TURN_STEPS; k++) put(start + (7 * k) / TURN_STEPS, name, from + ((to - from) * k) / TURN_STEPS)
  }
  // p rests at 0 until it turns spring to summer, and drops back to 0 in the middle of autumn, where it has no weight
  put(0, 'p', 0), turn('p', 0, 100, 18), put(100, 'p', 0)
  // q is 100 for the winter and its turn to spring; it drops to 0 while spring and summer hold (no weight there)
  put(0, 'q', 100), turn('q', 0, 100, 68), put(100, 'q', 100)
  put(0, 'r', 0), turn('r', 0, 100, 43), turn('r', 100, 0, 93)
  const byValue = new Map<string, number[]>()
  for (const [at, v] of [...frames].sort((x, y) => x[0] - y[0])) byValue.set(v.join(';'), [...(byValue.get(v.join(';')) ?? []), at])
  return `@keyframes yr{${[...byValue].map(([v, at]) => `${at.map(a => `${short(a)}%`).join(',')}{${v}}`).join('')}}`
}

// ---------- weather, on the same year timeline (percent, value) ----------

type Track = readonly (readonly [number, number])[]
const WEATHER: Record<string, Track> = {
  // grey veil over the whole picture
  ov: [[0, 0], [5, 0], [10, 0.34], [15, 0.34], [20, 0], [30, 0], [35, 0.46], [41, 0.46], [46, 0], [55, 0], [60, 0.36], [66, 0.36], [71, 0], [74, 0], [79, 0.34], [90, 0.34], [95, 0], [100, 0]],
  // clouds: a few always drift by, they gather slowly for a grey spell or snow
  cg: [[0, 0.45], [4, 0.5], [10, 1], [15, 1], [21, 0.45], [25, 0.3], [29, 0.35], [35, 1], [41, 1], [47, 0.35], [50, 0.55], [54, 0.6], [60, 1], [66, 1], [72, 0.55], [73, 0.6], [79, 1], [90, 1], [96, 0.45], [100, 0.45]],
  // the sun or moon and the stars dim slowly under cloud
  li: [[0, 1], [5, 1], [10, 0.15], [15, 0.15], [20, 1], [30, 1], [35, 0.1], [41, 0.1], [46, 1], [55, 1], [60, 0.2], [66, 0.2], [71, 1], [74, 1], [79, 0.15], [90, 0.15], [95, 1], [100, 1]],
  sn: [[0, 0], [78, 0], [82, 1], [89, 1], [93, 0], [100, 0]],
}
/** Fireflies come out around midsummer (summer stands fullest at 34%). */
const FIREFLY_YEAR: Track = [[0, 0], [24, 0], [28, 1], [40, 1], [44, 0], [100, 0]]
export const WEATHERS = ['clear', 'cloudy', 'snow'] as const
export type Weather = (typeof WEATHERS)[number]
/** Each weather held still: the veil, the clouds, the light and the snow. */
const HELD: Record<Weather, Record<string, number>> = {
  clear: { ov: 0, cg: 0.4, li: 1, sn: 0 },
  cloudy: { ov: 0.3, cg: 1, li: 0.15, sn: 0 },
  snow: { ov: 0.32, cg: 1, li: 0.15, sn: 1 },
}
const trackAt = (t: Track, pct: number) => {
  for (let i = 0; i < t.length - 1; i++) {
    const [p0, v0] = t[i]!
    const [p1, v1] = t[i + 1]!
    if (pct >= p0 && pct <= p1) {
      return v0 + (v1 - v0) * (p1 === p0 ? 0 : (pct - p0) / (p1 - p0))
    }
  }
  return t[0]![1]
}
// (the points that share a value share one rule, as timeline() does)
const trackKeyframes = (name: string, t: Track) => timeline(name, 100, t.map(([p, v]) => [p, `opacity:${short(v)}`]))

// ---------- geometry ----------

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const R = Math.round
/** Take n draws from a stream and throw them away: a part drawn afresh from its own stream leaves the scene's stream
 * where it was, so everything drawn after it keeps its place. */
const skip = (rand: () => number, n: number) => {
  for (let i = 0; i < n; i++) rand()
}

/** Two numbers as a path pair, with no space before a minus sign. */
const pair = (a: number, b: number) => `${a}${b < 0 ? '' : ' '}${b}`
/** Numbers as path data: a space between two, none before a minus sign. (-0 is written 0.) */
const nums = (...v: number[]) => v.map((n, i) => `${i > 0 && n >= 0 ? ' ' : ''}${n === 0 ? 0 : n}`).join('')

// ---------- encoding: ovals as one path ----------
/** An ellipse [cx, cy, rx, ry] in whole units. */
type Oval = readonly [number, number, number, number]
/** Ellipses of one colour as one filled path, all turning the same way, so the path's nonzero fill is their union,
 * which is what the same ellipses one by one in one opaque colour make. Each is one arc, the long way round, from a
 * unit above its left point to a unit below it (a16 11 0 110 2: flags 1 and 1, then 0 2, which SVG path syntax allows
 * with no space after a flag), and the fill closes the gap: the arc's ellipse sits rx(1 - sqrt(1 - 1/ry^2)) further
 * right than drawn (under a tenth of a unit) and the chord across the gap strays from it by as little, where two half
 * arcs took twice the characters. Order is free, as for dabs; each starts with a relative move from where the last ended. */
function ovalPath(ovals: readonly Oval[]): string {
  let d = ''
  let [px, py] = [0, 0]
  for (const [cx, cy, rx, ry] of [...ovals].sort((a, b) => a[0] - a[2] - (b[0] - b[2]) || a[1] - b[1])) {
    const [x, y] = [cx - rx, cy - 1]
    d += `${d ? 'm' : 'M'}${pair(x - px, y - py)}a${rx} ${ry} 0 110 2`
    ;[px, py] = [x, y + 2]
  }
  return d
}

// ---------- encoding: dabs as path data ----------
// A dab is one straight stroke [x, y, dx, dy] in whole units, with round caps. All the dabs of one colour go in one
// path, each its own subpath: a relative move from where the last dab ended, then the stroke.
// Two freedoms make that short, and neither changes the picture:
// - Order. One path is stroked as one shape: its subpaths are unioned and painted once, with the path's colour and
//   opacity, so the order of the dabs inside it is free (even when the stroke is not opaque: overlapping dabs of one
//   path never paint twice). Order between paths is not free, and dabs never move from one path to another.
// - Direction. A straight stroke with round caps (and no joins) is the same drawn from either end.
// So the dabs are put in several orders (as drawn, nearest next, nearest next untangled by 2-opt, and serpentine
// strips of a few heights), each dab
// in each order is turned whichever way writes shortest (worked out exactly, along the order), and the shortest
// path data wins.
/** Characters a number takes in path data, and the separator before it (none before a minus sign). */
const numLen = (v: number) => String(v).length
const sepLen = (v: number) => (v < 0 ? 0 : 1)
/** Characters to draw a dab's stroke right after a move: h or v when it is level or upright, else a bare pair (the
 * pair after a move is a line by itself). */
const segLen = (dx: number, dy: number) =>
  dx === 0 && dy === 0 ? 1 : dy === 0 ? 1 + numLen(dx) : dx === 0 ? 1 + numLen(dy) : sepLen(dx) + numLen(dx) + sepLen(dy) + numLen(dy)
/** A dot (a dab of no length: its round caps draw it) closes its subpath, which brings the pen back to the same point. */
const segStr = (dx: number, dy: number) =>
  dx === 0 && dy === 0 ? 'z' : dy === 0 ? `h${dx}` : dx === 0 ? `v${dy}` : `${dx < 0 ? '' : ' '}${pair(dx, dy)}`
type Dab = readonly [number, number, number, number]
/** The path data for dabs in this order, each turned the way that writes it shortest: two states per dab (as given,
 * or from its other end) and the cheapest run through them, found exactly. */
function dabOrder(dabs: readonly Dab[], order: readonly number[]): string {
  const ends = (i: number, flip: number): Dab => {
    const [x, y, dx, dy] = dabs[order[i]!]!
    return flip ? [x + dx, y + dy, -dx, -dy] : [x, y, dx, dy]
  }
  const n = order.length
  // cost[i][s]: characters up to and including dab i drawn in state s; from[i][s]: the state of dab i - 1 then
  const cost: [number, number][] = []
  const from: [number, number][] = []
  for (let i = 0; i < n; i++) {
    cost.push([Infinity, Infinity])
    from.push([0, 0])
    for (const s of [0, 1]) {
      const [x, y, dx, dy] = ends(i, s)
      if (i === 0) {
        cost[0]![s] = segLen(dx, dy) + 1 + numLen(x) + sepLen(y) + numLen(y)
        continue
      }
      for (const t of [0, 1]) {
        const [qx, qy, qdx, qdy] = ends(i - 1, t)
        const [mx, my] = [x - qx - qdx, y - qy - qdy]
        const c = cost[i - 1]![t]! + 1 + numLen(mx) + sepLen(my) + numLen(my) + segLen(dx, dy)
        if (c < cost[i]![s]!) [cost[i]![s], from[i]![s]] = [c, t]
      }
    }
  }
  const states: number[] = []
  let s = cost[n - 1]![0] <= cost[n - 1]![1] ? 0 : 1
  for (let i = n - 1; i >= 0; i--) states[i] = s, (s = from[i]![s]!)
  let d = ''
  let [px, py] = [0, 0]
  for (let i = 0; i < n; i++) {
    const [x, y, dx, dy] = ends(i, states[i]!)
    // (a path's first m is a move to absolute coordinates, and the pairs after it are relative lines, as after any m)
    d += i === 0 ? `m${pair(x, y)}${segStr(dx, dy)}` : `m${pair(x - px, y - py)}${segStr(dx, dy)}`
    ;[px, py] = [x + dx, y + dy]
  }
  return d
}
/** Nearest next: from the leftmost dab, always the closest start or end of a dab not yet drawn. */
function nearestOrder(dabs: readonly Dab[]): number[] {
  const left = dabs.map((_, i) => i)
  const mid = (i: number) => [dabs[i]![0] + dabs[i]![2] / 2, dabs[i]![1] + dabs[i]![3] / 2]
  let k = 0
  for (let i = 1; i < dabs.length; i++) if (mid(i)[0]! < mid(k)[0]!) k = i
  const order = [k]
  left.splice(k, 1)
  let [px, py] = [dabs[k]![0] + dabs[k]![2], dabs[k]![1] + dabs[k]![3]]
  while (left.length > 0) {
    let best = 0
    let bestD = Infinity
    let bestEnd: [number, number] = [0, 0]
    for (let j = 0; j < left.length; j++) {
      const [x, y, dx, dy] = dabs[left[j]!]!
      const a = Math.hypot(x - px, y - py)
      const b = Math.hypot(x + dx - px, y + dy - py)
      if (a < bestD) [best, bestD, bestEnd] = [j, a, [x + dx, y + dy]]
      if (b < bestD) [best, bestD, bestEnd] = [j, b, [x, y]]
    }
    order.push(left[best]!)
    ;[px, py] = bestEnd
    left.splice(best, 1)
  }
  return order
}
/** An order shortened by 2-opt on the dabs' middles: wherever two legs of the tour cross, turn the run between. */
function untangle(dabs: readonly Dab[], start: readonly number[]): number[] {
  const order = [...start]
  const mx = dabs.map(([x, , dx]) => x + dx / 2)
  const my = dabs.map(([, y, , dy]) => y + dy / 2)
  const dist = (a: number, b: number) => Math.hypot(mx[order[a]!]! - mx[order[b]!]!, my[order[a]!]! - my[order[b]!]!)
  for (let pass = 0, better = true; better && pass < 30; pass++) {
    better = false
    for (let i = 0; i < order.length - 3; i++) {
      for (let j = i + 2; j < order.length - 1; j++) {
        if (dist(i, i + 1) + dist(j, j + 1) > dist(i, j) + dist(i + 1, j + 1) + 1e-9) {
          let [a, b] = [i + 1, j]
          while (a < b) [order[a], order[b]] = [order[b]!, order[a]!], a++, b--
          better = true
        }
      }
    }
  }
  return order
}
/** Serpentine strips: strips of this height top to bottom, left to right along one, right to left along the next. */
function stripOrder(dabs: readonly Dab[], h: number): number[] {
  const key = (i: number) => {
    const [x, y, dx, dy] = dabs[i]!
    const strip = Math.floor((y + dy / 2) / h)
    const mx = x + dx / 2
    return [strip, strip % 2 === 0 ? mx : -mx] as const
  }
  return dabs.map((_, i) => i).sort((a, b) => {
    const [ka, kb] = [key(a), key(b)]
    return ka[0] - kb[0] || ka[1] - kb[1] || a - b
  })
}
/** Characters of a relative move by (dx, dy), its letter included. */
const moveLen = (dx: number, dy: number) => 1 + numLen(dx) + sepLen(dy) + numLen(dy)
/** An order and the way each dab is drawn, shortened by local search on the characters themselves: 2-opt (a run of
 * the order drawn backwards, each of its dabs from its other end) and or-opt (a run of one to three dabs moved
 * elsewhere, either way round), each step taken only when the written length goes down. The moves inside a turned run
 * change sign, which can cost or save a minus: prefix sums over the run keep each step's count exact and O(1). */
function shorten(dabs: readonly Dab[], start: readonly number[]): number[] {
  const n = start.length
  if (n < 4) return [...start]
  const p = [...start]
  // the way each dab is drawn: 0 as given, 1 from its other end; first from the exact pass over the start order
  const f = new Array<number>(dabs.length).fill(0)
  {
    const cost: [number, number][] = []
    const from: [number, number][] = []
    for (let i = 0; i < n; i++) {
      cost.push([Infinity, Infinity]), from.push([0, 0])
      for (const s of [0, 1]) {
        const [x, y, dx, dy] = dabs[p[i]!]!
        const [sx, sy, sdx, sdy] = s ? [x + dx, y + dy, -dx, -dy] : [x, y, dx, dy]
        if (i === 0) { cost[0]![s] = segLen(sdx, sdy); continue }
        for (const t of [0, 1]) {
          const [qx, qy, qdx, qdy] = dabs[p[i - 1]!]!
          const [ex, ey] = t ? [qx, qy] : [qx + qdx, qy + qdy]
          const c = cost[i - 1]![t]! + moveLen(sx - ex, sy - ey) + segLen(sdx, sdy)
          if (c < cost[i]![s]!) [cost[i]![s], from[i]![s]] = [c, t]
        }
      }
    }
    let s = cost[n - 1]![0] <= cost[n - 1]![1] ? 0 : 1
    for (let i = n - 1; i >= 0; i--) f[p[i]!] = s, (s = from[i]![s]!)
  }
  const sx = (d: number, fl = f[d]!) => (fl ? dabs[d]![0] + dabs[d]![2] : dabs[d]![0])
  const sy = (d: number, fl = f[d]!) => (fl ? dabs[d]![1] + dabs[d]![3] : dabs[d]![1])
  const ex = (d: number, fl = f[d]!) => (fl ? dabs[d]![0] : dabs[d]![0] + dabs[d]![2])
  const ey = (d: number, fl = f[d]!) => (fl ? dabs[d]![1] : dabs[d]![1] + dabs[d]![3])
  const seg = (d: number, fl = f[d]!) => (fl ? segLen(-dabs[d]![2], -dabs[d]![3]) : segLen(dabs[d]![2], dabs[d]![3]))
  /** The move from a drawn as fa to b drawn as fb. */
  const mv = (a: number, b: number, fa = f[a]!, fb = f[b]!) => moveLen(sx(b, fb) - ex(a, fa), sy(b, fb) - ey(a, fa))
  // T[k]: what turning the run p[0..k] costs inside it (its moves negated, its dabs' strokes from the other end), as
  // prefix sums: turning p[a..b] changes the inside by (M[b] - M[a]) + (G[b + 1] - G[a])
  let M: number[] = []
  let G: number[] = []
  const sums = () => {
    M = [0]
    G = [0]
    for (let k = 0; k < n; k++) {
      const d = p[k]!
      G.push(G[k]! + seg(d, 1 - f[d]!) - seg(d))
      if (k > 0) {
        const [a, b] = [p[k - 1]!, d]
        M.push(M[k - 1]! + mv(b, a, 1 - f[b]!, 1 - f[a]!) - mv(a, b))
      }
    }
  }
  const inside = (a: number, b: number) => M[b]! - M[a]! + G[b + 1]! - G[a]!
  const turnRun = (a: number, b: number) => {
    for (let k = a; k <= b; k++) f[p[k]!] = 1 - f[p[k]!]!
    for (let lo = a, hi = b; lo < hi; lo++, hi--) [p[lo], p[hi]] = [p[hi]!, p[lo]!]
  }
  // or-opt tries a run only next to its near neighbours (by the dabs' middles)
  const K = 8
  const mid = dabs.map(([x, y, dx, dy]) => [x + dx / 2, y + dy / 2] as const)
  const near = dabs.map((_, a) => {
    // the K nearest, kept in order by insertion
    const best: [number, number][] = []
    for (const b of p) {
      if (b === a) continue
      const dd = (mid[b]![0] - mid[a]![0]) ** 2 + (mid[b]![1] - mid[a]![1]) ** 2
      if (best.length === K && dd >= best[K - 1]![0]) continue
      let k = best.length
      while (k > 0 && best[k - 1]![0] > dd) k--
      best.splice(k, 0, [dd, b])
      if (best.length > K) best.pop()
    }
    return best.map(([, b]) => b)
  })
  const pos = new Array<number>(dabs.length)
  const where = () => p.forEach((d, k) => (pos[d] = k))
  sums()
  where()
  for (let pass = 0, better = true; better && pass < 6; pass++) {
    better = false
    // 2-opt: draw p[i+1..j] backwards
    for (let i = -1; i < n - 1; i++) {
      // (the run's new neighbours: p[i] next to p[j], p[i+1] next to p[j+1]; or the run ending the path)
      const js = new Set<number>([n - 1])
      if (i >= 0) for (const q of near[p[i]!]!) js.add(pos[q]!)
      for (const q of near[p[i + 1]!]!) js.add(pos[q]! - 1)
      for (const j of js) {
        if (j < i + 2) continue
        const [a, b] = [p[i + 1]!, p[j]!]
        let old = 0
        let now = inside(i + 1, j)
        if (i >= 0) old += mv(p[i]!, a), (now += mv(p[i]!, b, f[p[i]!], 1 - f[b]!))
        if (j < n - 1) old += mv(b, p[j + 1]!), (now += mv(a, p[j + 1]!, 1 - f[a]!, f[p[j + 1]!]))
        if (now < old) {
          turnRun(i + 1, j)
          sums()
          where()
          better = true
        }
      }
    }
    // or-opt: take p[i..i+L-1] out and put it between p[k] and p[k+1], as it is or turned
    for (let L = 1; L <= 3; L++) {
      for (let i = 0; i + L <= n; i++) {
        const [a, b] = [p[i]!, p[i + L - 1]!]
        const before = i > 0 ? p[i - 1]! : -1
        const after = i + L < n ? p[i + L]! : -1
        let out = 0
        if (before >= 0) out += mv(before, a)
        if (after >= 0) out += mv(b, after)
        if (before >= 0 && after >= 0) out -= mv(before, after)
        let moved = false
        const ks = new Set<number>([-1, n - 1])
        for (const q of [...near[a]!, ...near[b]!]) ks.add(pos[q]!), ks.add(pos[q]! - 1)
        for (const k of ks) {
          if (k >= i - 1 && k < i + L) continue
          const [u, v] = [k >= 0 ? p[k]! : -1, k + 1 < n ? p[k + 1]! : -1]
          if (moved) break
          for (const turned of [0, 1]) {
            const [h, t] = turned ? [b, a] : [a, b]
            const [fh, ft] = turned ? [1 - f[b]!, 1 - f[a]!] : [f[a]!, f[b]!]
            let add = turned ? inside(i, i + L - 1) : 0
            if (u >= 0) add += mv(u, h, f[u]!, fh)
            if (v >= 0) add += mv(t, v, ft, f[v]!)
            if (u >= 0 && v >= 0) add -= mv(u, v)
            if (add < out) {
              const run = p.splice(i, L)
              if (turned) { run.reverse(); for (const d of run) f[d] = 1 - f[d]! }
              const at = k < i ? k + 1 : k + 1 - L
              p.splice(at, 0, ...run)
              sums()
              where()
              better = true
              moved = true
              break
            }
          }
        }
      }
    }
  }
  return p
}
/** `flat`: the dabs are to be drawn with flat ends, so each is written longer by this much at both ends (half its
 * width) and covers what its round ends did. The app draws the whole picture small every frame to time it, and a
 * round end costs it about twice what a flat one does: with some four thousand dabs in the woods that is a third
 * of the frame. */
function dabPath(given: readonly Dab[], flat = 0): string {
  if (given.length === 0) return ''
  const dabs: readonly Dab[] = flat
    ? given.map(([x, y, dx, dy]) => {
        const k = 1 + (2 * flat) / (Math.hypot(dx, dy) || 1)
        const [nx, ny] = [R(dx * k), R(dy * k)]
        return [R(x - (nx - dx) / 2), R(y - (ny - dy) / 2), nx, ny] as const
      })
    : given
  const asDrawn = dabs.map((_, i) => i)
  let best = dabOrder(dabs, asDrawn)
  let bestOrder = asDrawn
  const near = nearestOrder(dabs)
  for (const order of [near, untangle(dabs, near), ...[6, 10, 16, 24, 40].map(h => stripOrder(dabs, h))]) {
    const d = dabOrder(dabs, order)
    if (d.length < best.length) [best, bestOrder] = [d, order]
  }
  const d = dabOrder(dabs, shorten(dabs, bestOrder))
  return d.length < best.length ? d : best
}

/** Dabs gathered per slot, each a short stroke; written as one path per slot with relative moves, which keeps it small. */
class Dabs {
  bySlot = new Map<string, [number, number, number, number][]>()
  /** Halved in the lighter picture. */
  thin = false
  /** Above 0: flat-ended dabs, lengthened by this much at each end (see dabPath). */
  flat = 0
  ends(flat: number) {
    this.flat = flat
    return this
  }
  add(slot: string, x: number, y: number, dx: number, dy: number) {
    const list = this.bySlot.get(slot) ?? []
    list.push([R(x), R(y), R(dx), R(dy)])
    this.bySlot.set(slot, list)
  }
  /** Fix the order slots are drawn in (shadow under light), before any dab is added. */
  order(...slots: string[]) {
    for (const slot of slots) this.bySlot.set(slot, [])
    return this
  }
  /** One slot's dabs as path data (see dabPath). */
  d(slot: string) {
    return dabPath((this.bySlot.get(slot) ?? []).filter((_, i) => !(lite && this.thin && i % 2 === 1)), this.flat)
  }
  /** width 0: leave the stroke width to the stylesheet. */
  svg(width: number, extra = '', keep: (slot: string) => boolean = () => true) {
    return [...this.bySlot.entries()]
      .filter(([slot, dabs]) => dabs.length > 0 && keep(slot))
      .map(([slot]) => `<path class="${slot}${this.flat ? ' bu' : ''}"${extra}${width ? ` stroke-width="${width}"` : ''} d="${this.d(slot)}"/>`)
      .join('')
  }
}

// The land, as outlines read from the left: each a sum of a few rounded bumps and a little unevenness, so no
// ridge is a ruler line or a perfect arc. Four planes step back, each paler and bluer than the one before: the near
// woods (slopeL, slopeR), two middle ridges of woods half lost in the haze (midY, mid2Y), the blue far hill (farY) and
// the palest ridge behind it (far2Y).
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2))
const rise = (t: number) => 1 / (1 + Math.exp(-t))
const ripple = (x: number, a: number, b: number) => 2.5 * Math.sin(x / a) + 1.5 * Math.sin(x / b)
/** The left hill: its crest just left of the middle of the left clear strip, a knoll and a dip beyond it toward the
 * edge, a shoulder on its way down, and a long gentle run to its point at L_END. */
const slopeL = (x: number) => 656 - 121 * rise((580 - x) / 88) - 40 * bump(x, 15, 135) - 15 * bump(x, 265, 70) - 9 * bump(x, -395, 70) - ripple(x, 31, 13)
const L_END = 790
/** The right hill: a low point of land from R_START, then a rounded headland, its crest in the right clear strip,
 * falling past it into a saddle and rising a little to the edge. Higher and rounder than the left one. */
const slopeR = (x: number) => 654 - 13 * rise((x - 1150) / 22) - 13 * bump(x, 1290, 85) - 162 * bump(x, 1735, x < 1735 ? 180 : 160) - 104 * rise((x - 1945) / 34) - ripple(x, 27, 11)
const R_START = 1135
/** The nearer middle ridge: behind the left hill's run, standing out past its point; and behind the right hill's low point. */
const midY = (x: number) => 655 - 72 * bump(x, 690, 120) - 32 * bump(x, 540, 85) - 16 * bump(x, 790, 45) - 56 * bump(x, 1310, 95) - 30 * bump(x, 1440, 80) - 10 * bump(x, 1220, 40) - ripple(x, 23, 9)
/** The farther middle ridge: across the gap in front of the blue hill, a long shoulder behind the right hill's saddle
 * running on out of the picture, and a hump behind the left hill's dip. */
const mid2Y = (x: number) => 654 - 52 * bump(x, 1050, 95) - 28 * bump(x, 910, 65) - 12 * bump(x, 1130, 40) - (x > 1700 ? 142 * rise((x - 1930) / 24) + 16 * bump(x, 2008, 35) + 10 * bump(x, 2088, 40) + 4 * Math.sin(x / 17) : 0) - 150 * bump(x, -260, 110) - ripple(x, 19, 8)
/** The near land's top: the higher of the two hills, or the water line. */
const nearY = (x: number) => Math.min(x <= L_END ? slopeL(x) : SHORE, x >= R_START ? slopeR(x) : SHORE, SHORE)
/** A second, farther ridge, showing over the far hill in the gap between the woods. */
const far2Y = (x: number) => 624 - 30 * Math.exp(-(((x - 820) / 110) ** 2)) - 62 * Math.exp(-(((x - 1015) / 140) ** 2)) - 3 * Math.sin(x / 23)
const farY = (x: number) =>
  630 - 52 * Math.exp(-(((x - 930) / 105) ** 2)) - 36 * Math.exp(-(((x - 1090) / 80) ** 2)) - 22 * Math.exp(-(((x - 720) / 125) ** 2)) - 5 * Math.sin(x / 37)

function stars(rand: () => number) {
  // each star a dot: a dab of no length, which its round caps draw; the first thirteen again, bigger and fainter
  const p: Dab[] = []
  for (let i = 0; i < 100; i++) {
    const x = X0 + rand() * (X1 - X0)
    const y = Y0 + rand() * (outY(440) - Y0)
    p.push([R(x), R(y), 0, 0])
  }
  return `<g class="sv"><g class="li"><path stroke="#f3eedb" stroke-width="${num(2.6 * ZK)}" d="${dabPath(p)}"/><path stroke="#f3eedb" stroke-width="${num(4 * ZK)}" opacity=".6" d="${dabPath(p.slice(0, 13))}"/></g></g>`
}

// Drawn round the origin; .sx carries it along its path, and .sr warms it to orange near the horizon.
function sun(rand: () => number) {
  const d = new Dabs()
  const cx = 0
  const cy = 0
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * 24
    d.add('su', cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a + 1.2) * 6, Math.sin(a + 1.2) * 6)
  }
  const halo = new Dabs()
  for (let i = 0; i < 80; i++) {
    const a = rand() * Math.PI * 2
    const r = 36 + rand() * 34
    halo.add('su', cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a + 1.5) * 7, Math.sin(a + 1.5) * 7)
  }
  return `<g class="sx"><g class="li" transform="scale(${ZK})">${halo.svg(6, ' stroke-opacity=".3"')}<circle class="sf" r="27"/>${d.svg(6, ' stroke-opacity=".55"')}<circle class="sr" r="29" fill="#ff8a3d"/></g></g>`
}

// Clouds in two layers that ride the wind at their own speeds: high near ones, larger and quicker, and low far ones
// near the horizon, smaller and slower, so the sky has depth. A few are big heaped cumulus on flat bases, the rest
// small puffs, with open sky between. No streaks: the user wants no lines across the sky.
type Spot = readonly [number, number, number, number]
const NEAR_CLOUDS: readonly Spot[] = [[260, 40, 500, 66], [1330, -70, 440, 58], [800, -170, 190, 26], [-110, -130, 170, 24]]
const FAR_CLOUDS: readonly Spot[] = [[930, 190, 330, 42], [300, 330, 190, 24], [1480, 300, 170, 24], [640, 410, 130, 17], [1190, 430, 150, 18], [-40, 250, 150, 22]]
/** Random draws the clouds of v21 took from the scene's stream: still taken, so the woods and reeds keep their places. */
const OLD_CLOUD_DRAWS = 3621

function cloudLayer(rand: () => number, spots: readonly Spot[], id: string) {
  const d = new Dabs().order('cs', 'cl')
  const soft: Oval[] = []
  // each cloud: a row of puffs, tallest in the middle, flat along its belly; a big one heaps a second tier on top
  // Drawn on v23's canvas (Z / ZK) and then scaled by ZK about the horizon, so the clouds keep their place and size on
  // screen however far back the view is pulled.
  const z = Z / ZK
  for (const [sx, sy, w, h] of spots) {
    const [cx, cy] = [800 + (sx - 800) * z, SHORE + (sy - SHORE) * z]
    const base = cy + h * 0.35
    const big = h > 40
    const k = Math.max(4, R(w / 60))
    const puffs: [number, number][] = []
    for (let i = 0; i < k; i++) {
      const u = i / (k - 1)
      const lift = Math.pow(Math.sin(Math.PI * u), big ? 0.6 : 1)
      const pr = h * (0.5 + 0.6 * lift) * (0.85 + rand() * 0.3)
      puffs.push([cx - w / 2 + u * w + (rand() - 0.5) * 16, pr])
    }
    if (big) for (const u of [0.32, 0.5, 0.7]) puffs.push([cx - w / 2 + u * w + (rand() - 0.5) * 30, h * (0.75 + rand() * 0.25)])
    for (const [i, [px, pr]] of puffs.entries()) {
      // puffs sit on the base; the second tier stands on the first
      const py = i < k ? base - pr * 0.75 : base - h * 0.55 - pr * 0.7
      soft.push([R(px), R(Math.min(py + pr * 0.15, base - pr * 0.8)), R(pr * 1.15), R(pr * 0.8)])
      // a big cloud is sparser inside, where its soft body shows; its edges keep the full touch
      const n = R(((pr * pr) / 64) * (big ? 0.6 : 1))
      for (let j = 0; j < n; j++) {
        const a = rand() * Math.PI * 2
        const r = Math.sqrt(big ? 0.25 + 0.75 * rand() : rand()) * pr
        const x = px + Math.cos(a) * r * 1.1
        const y = Math.min(base, py + Math.sin(a) * r * 0.8)
        const belly = (y - (base - h * 0.45)) / h + (rand() - 0.5) * 0.4
        const t = a + Math.PI / 2 + (rand() - 0.5) * 0.6
        d.add(belly > 0.15 ? 'cs' : 'cl', x, y, Math.cos(t) * 9, Math.sin(t) * 4)
      }
    }
  }
  // the lit strokes inherit their colour, so a copy of them can take the peach of a low sun (.cp)
  const span = R((X1 - X0) / ZK)
  return `<g transform="matrix(${num(ZK)} 0 0 ${num(ZK)} ${R(800 * (1 - ZK))} ${R(SHORE * (1 - ZK))})"><g id="${id}"><g class="cf"><g id="${id}s" opacity=".45"><path fill="inherit" d="${ovalPath(soft)}"/></g></g><g class="cs"><path id="${id}b" stroke-width="9" stroke-opacity=".9" d="${d.d('cs')}"/></g><g class="cl"><path id="${id}l" stroke-width="9" stroke-opacity=".9" d="${d.d('cl')}"/></g></g><use href="#${id}" x="${span}"/><g class="cp"><use href="#${id}s"/><use href="#${id}s" x="${span}"/><use href="#${id}l"/><use href="#${id}l" x="${span}"/></g>${id === 'cw' ? `<g class="cu"><use href="#${id}b"/><use href="#${id}b" x="${span}"/></g>` : ''}</g>`
}

function clouds(rand: () => number) {
  return `<g class="cg"><g class="ce">${cloudLayer(rand, FAR_CLOUDS, 'cv')}</g><g class="cd">${cloudLayer(rand, NEAR_CLOUDS, 'cw')}</g></g>`
}

/** An outline as a closed path: along the top of f from x0 to x1 in steps of `step`, down to the water, back along it. */
function outline(f: (x: number) => number, x0: number, x1: number, step: number) {
  let py = R(f(x0))
  let d = `M${x0} ${SHORE + 4}V${py}`
  for (let x = x0 + step; x <= x1; x += step) {
    const y = R(f(x))
    // (a line's letter carries over to the pairs after it)
    d += `${x === x0 + step ? 'l' : ' '}${nums(step, y - py)}`
    py = y
  }
  return `${d}V${SHORE + 4}z`
}
/** The top of the land in front of a plane: 0 the near hills, 1 with the nearer middle ridge, 2 with both. */
const cover = (plane: number, x: number) => Math.min(nearY(x), plane > 0 ? midY(x) : SHORE, plane > 1 ? mid2Y(x) : SHORE)

function farRidge(rand: () => number) {
  // finer dabs than v22 drew, from their own stream; the scene's stream skips the draws v22 took
  skip(rand, 3545)
  const fine = rng(6607)
  // only where the middle ridges and the near hills leave it showing
  const poly = outline(farY, 380, 1460, 20)
  const back = outline(far2Y, 620, 1220, 20)
  const d = new Dabs().ends(1.2)
  for (let x = 380; x < 1460; x += 7.5) {
    const top = farY(x)
    for (let y = top + 1.5; y < SHORE; y += 6) {
      const jx = x + (fine() - 0.5) * 4.5
      const jy = y + (fine() - 0.5) * 4.5
      const high = top < 600 && jy < top + 8
      const slot = high && fine() < 0.75 ? 'f3' : fine() < 0.5 ? 'fd' : 'f2'
      const dx = 2.3 + fine() * 1.7
      const dy = 0.7 + fine() * 1.6
      // no dabs where nearer land covers the ridge
      if (jy < cover(2, jx) + 2) d.add(slot, jx, jy, dx, dy)
    }
  }
  return `<path id="fq" class="fz" d="${back}"/><path id="fp" class="fr" d="${poly}"/><g stroke-width="2.4">${d.svg(0)}</g>`
}

/** Classes whose rule (`.ra path{stroke-width:...}`) gives the dabs of a middle ridge, and the reflection's blots, their
 * width: a descendant rule, so it outranks the slots' own width (.t1 and the rest). */
const RIDGE_W = ['ra', 'rb'] as const
/** Spans of the canvas each middle ridge stands above the water, and how much of the haze lies over it. */
const MIDS = [
  { f: mid2Y, spans: [[-480, -40], [800, 1240], [1760, X1]], haze: 0.62, w: 2.5 },
  { f: midY, spans: [[380, 1580]], haze: 0.44, w: 2.8 },
] as const
// The middle distance: wooded ridges painted in small close dabs of the woods' own colours, then veiled with the far
// ridge's blue (the farther, the thicker the veil), so the land steps back near, middle, far, farthest.
function midRidges() {
  const paint = rng(3301)
  return MIDS.map(({ f, spans, haze, w }, i) => {
    const id = `m${i}`
    const shape = spans.map(([x0, x1]) => outline(f, x0, x1, 24)).join('')
    const d = new Dabs().order('t1', 't4', 'c2', 't2', 't3').ends(w / 2)
    for (const [x0, x1] of spans) {
      for (let x = x0; x < x1; x += 9) {
        const top = f(x)
        for (let y = top + 1.2; y < SHORE + 2; y += 6.5) {
          const jx = x + (paint() - 0.5) * 4
          const jy = y + (paint() - 0.5) * 3.5
          const p = paint()
          const ang = 0.9 + (paint() - 0.5) * 1.2
          const len = 2.6 + paint() * 1.4
          if (jy > cover(1 - i, jx) + 2 || jy < f(jx)) continue
          // lit along the crest, shaded low down; dark conifers scattered through
          const slot = jy < top + 7 ? (p < 0.4 ? 't3' : p < 0.82 ? 't2' : 'c2') : p < 0.08 ? 't3' : p < 0.5 ? 't2' : p < 0.68 ? 'c2' : p < 0.85 ? 't1' : 't4'
          d.add(slot, jx, jy, Math.cos(ang) * len, -Math.sin(ang) * len)
        }
      }
    }
    return `<g class="gr"><path id="${id}" fill="inherit" d="${shape}"/></g><g class="${RIDGE_W[i]}">${d.svg(0)}</g><use href="#${id}" class="fr" opacity="${num(haze)}"/>`
  }).join('')
}

/** The woods' brushwork: area of crown per dab, the length of a dab, and its width (canvas units). */
const CROWN_AREA = 8.6
const DAB = 3.7
const DAB_W = 3.9
// A broadleaf crown: a round mass of upward strokes, lit from the upper right where the sun is, in shade underneath.
function crown(d: Dabs, rand: () => number, cx: number, cy: number, r: number) {
  const n = R((r * r) / CROWN_AREA)
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const rr = Math.sqrt(rand()) * r
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr * 0.85
    const light = (x * 0.8 - y * 1.1) / r + (rand() - 0.5) * 0.55
    const slot = light > 0.35 ? 't3' : light < -0.3 ? (rand() < 0.42 ? 't1' : 't4') : 't2'
    const ang = 0.9 + (rand() - 0.5) * 1.4
    d.add(slot, cx + x, cy + y, Math.cos(ang) * DAB, -Math.sin(ang) * DAB)
  }
}

// A conifer: tiers of drooping branch strokes narrowing to a point, lit on the right.
function conifer(d: Dabs, rand: () => number, cx: number, base: number, h: number) {
  const w = h * 0.34
  const n = R((w * h) / 16)
  for (let i = 0; i < n; i++) {
    const v = Math.pow(rand(), 0.8)
    const y = base - v * h
    const tier = (v * 5) % 1
    const half = w * (1 - v) * (0.55 + 0.5 * tier)
    const x = (rand() * 2 - 1) * half
    const side = x / Math.max(1, half) + (rand() - 0.5) * 0.6
    const slot = side > 0.3 || (v > 0.8 && rand() < 0.4) ? 'c3' : side < -0.25 ? 'c1' : 'c2'
    d.add(slot, cx + x, y, x > 0 ? 2.7 : -2.7, 1.2)
  }
}

/** Gap between trees in a row; rows are 0.6 of it apart, every other one set half a gap over. */
const GAP = 34
/** Groves: four trees drawn as one set of strokes (two in a row, two in the next set half a gap over) and set down with
 * one <use>, for the woods inside the hills; the trees along a skyline stand one by one. A frame costs about the
 * same per <use> however many strokes it holds, so groves keep the wider land as cheap as v23's. */
const GROVES = 7
/** Random draws v23's woods took from the scene's stream: still taken, so the reeds keep their shapes. */
const OLD_WOOD_DRAWS = 7647

function woods(sceneRand: () => number) {
  // the woods are drawn from their own stream
  const rand = rng(2207)
  skip(sceneRand, OLD_WOOD_DRAWS)
  // the ground the woods stand on, dark between the crowns (its colour comes from the group, so a copy can darken it)
  const left = outline(slopeL, X0 - 8, L_END, 16)
  const right = outline(slopeR, R_START, X1 + 16, 16)

  // The trees are a few drawn crowns and cones, each set down where it stands with <use>: the renderer repeats them,
  // so the picture stays small however many trees there are. Several of each size, so neighbours seldom match.
  // A tree's lit strokes sit in their own group (.vl) so a gust can flash them, as leaves turn their pale side to
  // the wind; the band a tree stands in hands the gust's timing down to it (--d).
  const lit = (slot: string) => slot === 't3' || slot === 'c3'
  type Shape = { id: string; r: number; kind: 'b' | 'c'; slots: [string, [number, number, number, number][]][]; dabs: [number, number, number, number][] }
  const shapes: Record<'b' | 'c', Shape[][]> = { b: [], c: [] }
  let defs = ''
  const brush = rng(7741)
  for (const [kind, sizes, variants] of [['b', [10, 11.5, 13, 14.5], 4], ['c', [10, 12, 14], 3]] as const) {
    for (const r of sizes) {
      const row: Shape[] = []
      for (let v = 0; v < variants; v++) {
        const d = new Dabs().order('t1', 'c1', 't4', 't2', 'c2', 't3', 'c3').ends(DAB_W / 2)
        if (kind === 'c') conifer(d, brush, 0, 0, r * 3)
        else crown(d, brush, 0, 0, r)
        // (the trees' templates are named by single capital letters, A to Y: their names are written at every tree)
        const id = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[defs.split('<g id=').length - 1]!
        row.push({ id, r, kind, slots: [...d.bySlot.entries()], dabs: [...d.bySlot.values()].flat() })
        defs += `<g id="${id}">${d.svg(0, '', s => !lit(s))}<g class="vl">${d.svg(0, '', lit)}</g></g>`
      }
      shapes[kind].push(row)
    }
  }
  /** A tree as it is set down: its template and where its origin goes (a cone stands a little lower). */
  type Tree = { x: number; y: number; kind: 'b' | 'c'; shape: Shape }
  const tree = (x: number, y: number, r: number, kind: 'b' | 'c'): Tree => {
    const rows = shapes[kind]
    const row = rows.reduce((a, b) => (Math.abs(b[0]!.r - r) < Math.abs(a[0]!.r - r) ? b : a))
    const shape = row[Math.floor(rand() * row.length)]!
    return { x: R(x), y: R(kind === 'c' ? y + shape.r * 0.9 : y), kind, shape }
  }
  // the groves: four trees in the woods' own pattern (two in a row, two in the next set half a gap over), shifted a
  // little each, around a centre
  const groves: Tree[][] = []
  const thin = rng(613)
  for (let g = 0; g < GROVES; g++) {
    const four = [[-0.5, -0.3], [0.5, -0.3], [0, 0.3], [1, 0.3]].map(([u, v]) =>
      tree((u! + (rand() - 0.5) * 0.6) * GAP, (v! + (rand() - 0.5) * 0.35) * GAP, 10 + rand() * 5.5, rand() < 0.2 ? 'c' : 'b'))
    four.sort((a, b) => a.y - b.y)
    groves.push(four)
    // one set of strokes for the four, back to front, leaving out the strokes a crown in front of them covers (in one
    // path per colour the order between trees is lost, so a covered stroke would show through)
    const d = new Dabs().order('t1', 'c1', 't4', 't2', 'c2', 't3', 'c3').ends(DAB_W / 2)
    for (const [i, t] of four.entries()) {
      const front = four.slice(i + 1).filter(f => f.kind === 'b')
      for (const [slot, dabs] of t.shape.slots) {
        for (const [x, y, dx, dy] of dabs) {
          const [ax, ay] = [t.x + x + dx / 2, t.y + y + dy / 2]
          if (front.some(f => ((ax - f.x) / f.shape.r) ** 2 + ((ay - f.y) / (0.85 * f.shape.r)) ** 2 < 0.75)) continue
          // inside the woods half the shade is left to the dark ground between the crowns, which is the same colour
          if ((slot === 't1' || slot === 't4') && thin() < 0.5) continue
          d.add(slot, t.x + x, t.y + y, dx, dy)
        }
      }
    }
    defs += `<g id="k${g}">${d.svg(0, '', s => !lit(s))}<g class="vl">${d.svg(0, '', lit)}</g></g>`
  }

  // staggered rows of trees; the top row stands on the ridge, so crowns break the skyline. Taken four places at a
  // time: where all four lie deep in the woods a grove stands there, elsewhere each place gets its own tree.
  type Stand = { x: number; y: number; use: string; trees: Tree[] }
  const stands0: Stand[] = []
  const single = (t: Tree) => stands0.push({ x: t.x, y: t.y, use: `<use href="#${t.shape.id}" x="${t.x}" y="${t.y}"/>`, trees: [t] })
  const group = (id: string, members: Tree[], x: number, y: number) =>
    stands0.push({ x, y, use: `<use href="#${id}" x="${x}" y="${y}"/>`, trees: members.map(t => ({ ...t, x: t.x + x, y: t.y + y })) })
  const plant = (x0: number, x1: number, top: (x: number) => number) => {
    const dy = GAP * 0.6
    // rows counted up from the water, each pair of rows taken together
    const rowY = (a: number) => SHORE - 4 - a * dy
    for (let i = 0; rowY(i + 1) > 430; i += 2) {
      for (let j = 0; x0 + j * GAP < x1; j += 2) {
        const places = [[i, j], [i, j + 1], [i + 1, j], [i + 1, j + 1]].map(([a, b]) => [x0 + b! * GAP - (a! % 2) * GAP * 0.5, rowY(a!)] as const)
        const inside = ([x, y]: readonly [number, number]) => y - 6 > top(x) + 2 && y + 6 <= SHORE + 4 && x <= x1
        if (places.every(inside)) {
          const g = Math.floor(rand() * GROVES)
          group(`k${g}`, groves[g]!, R(x0 + j * GAP + (rand() - 0.5) * 6), R(rowY(i + 0.5) + (rand() - 0.5) * 4))
          continue
        }
        for (const [x, y] of places) {
          const jx = x + (rand() - 0.5) * GAP * 0.6
          const jy = y + (rand() - 0.5) * GAP * 0.35
          const r = 10 + rand() * 5.5
          const kind = rand() < 0.2 ? 'c' : 'b'
          if (jy < top(jx) - 2 || jy > SHORE || x > x1) continue
          single(tree(jx, jy, r, kind))
        }
      }
    }
    // the ridge: crowns standing on the line itself
    for (let x = x0; x < x1; x += GAP * 0.8) {
      const jx = x + (rand() - 0.5) * GAP * 0.4
      const y = top(jx) + 1 + rand() * 4
      if (y < SHORE) single(tree(jx, y, 9 + rand() * 5, rand() < 0.3 ? 'c' : 'b'))
    }
  }
  plant(X0 - 12, L_END, slopeL)
  plant(R_START - 6, X1 + 20, slopeR)
  stands0.sort((a, b) => a.y - b.y)

  // GUST_BANDS bands across the picture, each split in two by turns: a gust sweeps across band by band from the
  // right, and neighbouring trees never move as one.
  // The skyline the hills and treetops make is read off the strokes as they are set down: the dawn and dusk glow and
  // the moon are kept above it, so the moon sets behind the trees and the glow does not lie over the land.
  const stands = Array.from({ length: GUST_BANDS * 2 }, () => '')
  // the woods as the lake shows them: each tree a couple of flat dabs of its colours
  const soft = new Dabs().order('t1', 'c1', 't2', 'c2', 't3')
  const tops = new Map<number, number>()
  const reach = (x: number, y: number) => {
    const k = Math.round(x / 16)
    tops.set(k, Math.min(tops.get(k) ?? Infinity, y))
  }
  for (const [i, s] of stands0.entries()) {
    const band = Math.min(GUST_BANDS - 1, Math.max(0, Math.floor(((s.x - X0) / (X1 - X0)) * GUST_BANDS)))
    stands[band * 2 + (i % 2)] += s.use
    // a grove shows in the lake as a long dab for each of its rows
    if (s.trees.length > 1) {
      for (const v of [-0.3, 0.3]) {
        const p = rand()
        soft.add(p < 0.5 ? 't2' : p < 0.75 ? 't1' : p < 0.9 ? 'c2' : 't3', s.x - GAP * (v < 0 ? 1.1 : 0.6) + (rand() - 0.5) * 6, s.y + v * GAP - 6 + (rand() - 0.5) * 3, GAP * 1.6, 0)
      }
    }
    for (const { x, y, kind, shape } of s.trees) {
      // two flat dabs of its colours, as the ripples break a reflection into strokes
      const [top, w] = kind === 'c' ? [y - shape.r * 2.2, shape.r * 0.5] : [y - shape.r * 0.5, shape.r * 1.3]
      for (let k = 0; s.trees.length === 1 && k < 2; k++) {
        const p = rand()
        const slot = kind === 'c' ? (k === 0 || p < 0.5 ? 'c2' : 'c1') : k === 0 ? 't2' : p < 0.5 ? 't1' : 't3'
        soft.add(slot, x - w / 2 + (rand() - 0.5) * 4, top + k * shape.r * (kind === 'c' ? 1.1 : 0.9) + (rand() - 0.5) * 3, w, 0)
      }
      for (const [dx, dy, ex, ey] of shape.dabs) reach(x + dx, y + dy), reach(x + dx + ex, y + dy + ey)
    }
  }
  let py = Y1 + 5
  skyline = `M${X0 - 8} ${py}`
  for (let k = Math.floor((X0 - 8) / 16); k * 16 <= X1 + 24; k++) {
    const x = k * 16
    const ground = Math.min(farY(x) - 1, x >= 620 && x <= 1220 ? far2Y(x) - 1 : SHORE, cover(2, x))
    const ny = R(Math.min(ground, tops.get(k) ?? Infinity) - 1)
    // (a line's letter carries over to the pairs after it)
    skyline += py === Y1 + 5 ? `V${ny}` : `${skyline.endsWith(`V${py}`) ? 'l' : ' '}${nums(16, ny - py)}`
    py = ny
  }
  skyline += `V${Y1 + 5}z`
  blots = `<g class="rc">${soft.svg(0)}</g>`

  // the shore line where land meets water
  const shore = new Dabs()
  for (let x = X0 - 4; x < X1; x += 10.5) {
    const onLand = x < L_END || x > R_START
    if (!onLand && rand() < 0.5) continue
    for (let k = 0; k < (onLand ? 2 : 1); k++) {
      shore.add(rand() < 0.6 ? 'g1' : 'g2', x + (rand() - 0.5) * 6, SHORE - 2 + k * 3 + (rand() - 0.5) * 1.5, 4 + rand() * 3, 0)
    }
    // reed tufts at the water's edge, in the clear strips either side of the chat
    if ((x < outX(200) || x > outX(1400)) && rand() < 0.6) shore.add('e1', x + (rand() - 0.5) * 6, SHORE + 1, (rand() - 0.5) * 4, -6 - rand() * 7)
  }
  // the woods a shade darker and richer at their feet, along the water
  const feet = '<use href="#ga" fill="url(#ft)"/><use href="#gb" fill="url(#ft)"/>'
  // the light on the hills' faces (see the light engine): one sheet for light from the east, one from the west
  const hills = [[slopeL, X0 - 8, L_END, 'ga'], [slopeR, R_START, X1 + 16, 'gb']] as const
  const sheets = (['le', 'lw'] as const).map((side, i) => hills.map(([f, x0, x1, id], j) => `<use href="#${id}" class="${side}" fill="url(#l${2 * i + j})"/>`).join('')).join('')
  defs += (['le', 'lw'] as const).map(side => hills.map(([f, x0, x1], j) => faceSheet(`l${(side === 'le' ? 0 : 2) + j}`, f, x0, x1, side === 'le')).join('')).join('')
  return `<defs>${defs}</defs><g class="gr"><path id="ga" fill="inherit" d="${left}"/><path id="gb" fill="inherit" d="${right}"/></g>${stands.map((u, i) => `<g class="u${i >> 1}"><g class="j${i & 1}">${u}</g></g>`).join('')}${feet}<g class="li">${sheets}</g>${shore.svg(3)}`
}

// The lake's ripples, finer toward the horizon: rows close-set and strokes small and thin in the far water, growing
// toward the viewer. Each layer is one tile of rows drawn once and repeated across with <use>; the two layers of a
// pair have tiles of different widths and take alternate rows, so the repeat never lines up and does not show.
/** Tile widths of the two layers of each pair: the far pair sways, the near pair flows left. */
const TILE = [R(760 * ZK), R(560 * ZK)] as const
/** Depths (0 at the far shore, 1 at the bottom) where the stroke width steps up; the far layers end at FAR_DEPTH. */
const BANDS_AT = [0.12, 0.28, 0.5, 0.75, 1] as const
const FAR_DEPTH = 0.28
const bandOf = (depth: number) => BANDS_AT.findIndex(b => depth < b)
const bandWidth = (b: number) => R((1.5 + 2.6 * ((BANDS_AT[b - 1] ?? 0) + BANDS_AT[b]!) / 2) * Z * 10) / 10
/** Copies of a tile of width t that cover the view, plus `more` (the distance it travels). */
const copies = (t: number, more: number) => Math.ceil((X1 - X0 + 40 + more) / t)

function water(rand: () => number) {
  // drawn afresh from their own stream; the scene's stream skips the draws v22's ripples took
  skip(rand, 9352)
  const wave = rng(9917)
  const tint = rng(5309)
  // [layer][band]: far layers f0 f1 (sway), near layers n0 n1 (flow), glitter h0 h1
  const grid = () => BANDS_AT.map((_, b) => {
    const d = new Dabs().order('w1', 'w4', 'w2', 'w5').ends(bandWidth(b) / 2)
    d.thin = true
    return d
  })
  const far = [grid(), grid()]
  const near = [grid(), grid()]
  const glint = [grid(), grid()]
  let row = 0
  let g = 0
  for (let y = SHORE + 4; y < Y1 + 6; row++) {
    const depth = (y - SHORE) / (Y1 - SHORE)
    const band = Math.max(0, bandOf(depth))
    const k = row % 2
    const tile = TILE[k]!
    const set = (depth < FAR_DEPTH ? far : near)[k]![band]!
    const r = rippleAt(depth)
    const step = r.row
    const size = () => r.dab[0]! + wave() * r.dab[1]!
    const space = () => r.gap[0]! + wave() * r.gap[1]!
    const jitter = () => (wave() - 0.5) * Math.min(step * 0.4, 5 * Z)
    const tilt = () => (wave() - 0.5) * r.tilt
    // one tile of this row: it starts with a stroke at x0 and stops short of x0 + tile, so copies join without a seam
    const x0 = X0 - 20 - wave() * 14
    for (let x = x0; x < x0 + tile - 3 * Z; ) {
      const len = Math.min(size(), x0 + tile - 2 * Z - x)
      const p = wave()
      const q = tint()
      const slot = depth > 0.4 && q < 0.045 ? 'w4' : depth < 0.3 && q < 0.06 ? 'w5' : p < 0.55 ? 'w2' : 'w1'
      if ((x === x0 || wave() < 0.66) && len > 2) set.add(slot, x, y + jitter(), len, tilt())
      x += len + space()
    }
    // the sun's glitter: a column of pale strokes under SUN_X, widening toward the viewer
    const half = (60 + depth * 130) * Z
    for (let x = SUN_X - half + wave() * 10; x < SUN_X + half; ) {
      const len = size()
      if (wave() < 0.45) glint[g++ % 2]![band]!.add('w3', x, y + jitter(), len, tilt())
      x += len + space()
    }
    y += step
  }
  // each band's paths in a group that gives their width (inherited, so a <use> copy keeps it)
  const paths = (bands: Dabs[], more = 0) => bands.map((d, b) => [d.svg(0), num(bandWidth(b) + more)]).map(([p, w]) => (p ? `<g stroke-width="${w}">${p}</g>` : '')).join('')
  // the ripples a little see-through: a group round all the layers gives that to every path and copy
  const tiles = (id: string, t: number, n: number, body: string) =>
    `<g id="${id}">${body}</g>${Array.from({ length: n - 1 }, (_, i) => `<use href="#${id}" x="${t * (i + 1)}"/>`).join('')}`
  const sway = far.map((bands, k) => `<g class="f${k}">${tiles(`wf${k}`, TILE[k]!, copies(TILE[k]!, 0), paths(bands))}</g>`)
  const flow = near.map((bands, k) => `<g class="n${k}">${tiles(`wn${k}`, TILE[k]!, copies(TILE[k]!, TILE[k]!), paths(bands))}</g>`)
  // the glitter a little bolder than the ripples round it
  const glitter = glint.map((bands, k) => `<g class="h${k}">${paths(bands, 0.6).replace(/ class="w3"/g, '')}</g>`)
  return `<g stroke-opacity=".82">${sway.join('')}${flow.join('')}</g><g transform="translate(-${SUN_X} 0)"><g class="gs"><g class="w3"><g id="gz" class="li">${glitter.join('')}</g></g><g class="gk"><use href="#gz"/></g></g></g>`
}

// Now and then a fish rises in the clear water at the sides: a small ring spreads and fades, each at its own spot
// on its own long round, so they come at no pattern. [x, y, seconds]
const RISES_AT = ([[30, 705], [236, 772], [150, 688], [1455, 716], [1612, 770], [1705, 694], [1790, 742]] as const).map(
  ([x, y]) => [outX(x), outY(y)] as const,
)
function rises() {
  // one ring drawn once, set at each spot
  return `<defs><g id="zq"><ellipse class="zr" rx="8.4" ry="2.3"/><ellipse class="zr" rx="4.3" ry="1.2"/></g></defs>${RISES_AT.map(([x, y], i) => `<g transform="translate(${x} ${y})"><use href="#zq" class="z${i}"/></g>`).join('')}`
}

// Fireflies on summer nights, low over the water and the reeds at both sides, above the night veil: each drifts on a
// small slow loop and glows softly on and off. [x, y, seconds]
const FIREFLY_AT = [[40, 905], [118, 820], [176, 1010], [232, 880], [86, 1080], [208, 760],
  [1410, 930], [1486, 792], [1560, 1040], [1622, 860], [1700, 975], [1760, 815], [1795, 1095]].map(
  ([x, y]) => [outX(x!), outY(y!)] as const,
)
function fireflies() {
  // one fly drawn once and set at each spot; every other one runs its loop the other way round
  const fly = '<g id="fo"><circle r="7.2" fill="#ffd25a" opacity=".28"/><circle r="2.6" fill="#fff3a6"/></g>'
  return `<g class="fs"><g class="ff"><defs>${fly}</defs>${FIREFLY_AT.map(([x, y], i) => { const { t, j, r } = HERD.flies[i]!; return `<use class="fy" style="--t:${short(t)}s;--j:${short(-(j * t).toFixed(1))}s${r ? ';--r:reverse' : ''}" href="#fo" x="${x}" y="${y}"/>` }).join('')}</g></g>`
}

function snow(rand: () => number) {
  // flakes are dots, as the stars are
  const flake = (): Dab => {
    const x = R(X0 + rand() * (X1 - X0))
    return [x, R(Y0 + rand() * (Y1 - Y0)), 0, 0]
  }
  const a = Array.from({ length: 160 }, flake)
  const b = Array.from({ length: 100 }, flake)
  return `<g class="sn"><g class="sk"><path id="sa" stroke="#fbfdff" stroke-width="${num(5 * ZK)}" d="${dabPath(a)}"/><path id="sb" stroke="#fbfdff" stroke-width="${num(8 * ZK)}" opacity=".8" d="${dabPath(b)}"/><use href="#sa" y="${Y0 - Y1}"/><use href="#sb" y="${Y0 - Y1}"/></g></g>`
}

// Dawn mist lying low on the far water: soft blobs of white that drift slowly left with the wind, shown only in the
// first light of morning (.ms) and gone as the sun climbs.
function mist(rand: () => number) {
  let blobs = ''
  for (let x = X0 - 200; x < X1; x += 260 + rand() * 160) {
    const w = 420 + rand() * 300
    const h = 34 + rand() * 26
    blobs += `<rect x="${R(x)}" y="${R(SHORE + 4 + rand() * 22 - h / 2)}" width="${R(w)}" height="${R(h)}"/>`
  }
  return `<g class="ms"><g class="md"><g id="mz" fill="url(#mg)">${blobs}</g><use href="#mz" x="${X1 - X0}"/></g></g>`
}

/** While true, build() makes the lighter picture: no reflection, no stars, half the sky and lake dabs. */
let lite = false
/** The land's skyline, as a closed path round everything below it (set by woods()). */
let skyline = ''
/** The woods as flat dabs of colour, a couple per tree, for the reflection (set by woods()). */
let blots = ''
const geometries = new Map<string, string>()

function buildTest() {
  return `<defs><linearGradient id="sg" x2="0" y2="1"><stop class="q1"/><stop class="q2" offset=".55"/><stop class="q3" offset="1"/></linearGradient><radialGradient id="gl"><stop stop-color="#ffd37a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd37a" stop-opacity="0"/></radialGradient></defs>
<rect fill="url(#sg)" x="${X0}" y="${Y0}" width="${X1 - X0}" height="${SHORE + 10 - Y0}"/>
<rect class="wa" x="${X0}" y="${SHORE}" width="${X1 - X0}" height="${Y1 - SHORE}"/>
<circle class="tm" cx="0" cy="200" r="40" fill="#fff6d8"/>
${boat()}`
}

// Birds, put in the way a painter flicks them in: a slim body and two wings, seen from the side and a little below,
// heading the way they fly. Each flies straight across the sky from one side to the other and never turns; out of
// sight it waits a while, then comes again at another height, from whichever side. Now and then a loose skein crosses,
// beating steadily; four gulls cross on their own, in short bursts of wingbeats between glides. By day only.
const SKEIN = [[0, 0, 0], [-27, -9, 0.21], [-51, -2, 0.43], [-76, -13, 0.12], [-99, -5, 0.34]] as const
/** Seconds for each gull's glide to rise and fall once. */
const GULLS = [7, 5.5, 8, 6.5] as const

// ---------- engine 4: animal motion ----------
// One set of rules for the creatures. A wingbeat's period goes with the square root of the bird's size, so the small
// birds of the flock beat faster than the gulls; a bird's stride goes with its size, so its speed (stride over beat)
// goes with the root of its size too. A bird climbs while it flaps and sinks back while it glides (CLIMB). Every
// creature's own phase (when its loop starts, which way it turns) comes from one seeded stream, `herd`, so no two
// move alike and none moves in step by accident. The rules size the gulls, the flock, the fireflies and the fish.
/** A gull's size (its scale, drawn), its wingbeat and its speed across the sky (canvas units a second): the rest
 * follow from these. */
const GULL_SIZE = 0.95
const BEAT_S = 0.87
const GULL_SPEED = 34 * ZK
/** The flock's birds, drawn this size. */
const FLOCK_SIZE = 0.46
/** Seconds of a wingbeat, and speed across, for a bird of this size. */
const beatOf = (size: number) => +(BEAT_S * Math.sqrt(size / GULL_SIZE)).toFixed(2)
const speedOf = (size: number) => GULL_SPEED * Math.sqrt(size / GULL_SIZE)
const FLOCK_BEAT = beatOf(FLOCK_SIZE)
/** Which of the two phases (a half beat apart) each bird of the flock takes, front to back: neighbours never together.
 * (The gulls take four phases, a quarter beat apart.) */
const SKEIN_PHASE = [0, 1, 0, 1, 0] as const
/** The creatures' own phases and loops: one seeded stream, read in a fixed order (fish, fireflies, flock, gulls). */
const HERD = (() => {
  const herd = rng(5501)
  return {
    fish: RISES_AT.map(() => ({ t: R(40 + herd() * 60), j: herd() })),
    flies: FIREFLY_AT.map(() => ({ t: +(8 + herd() * 6).toFixed(1), j: herd(), r: herd() < 0.5 })),
    flock: SKEIN.map(() => ({ t: +(4.5 + herd() * 2.5).toFixed(1), j: herd() })),
    gulls: GULLS.map(() => ({ j: herd(), d: herd() })),
  }
})()
/** Seeds of the gulls' rounds, picked so no two gulls fly alike: two start gliding, two beating; bursts of two to
 * five beats, glides of three to eleven seconds, rounds of 28 to 33 seconds. */
const ROUND_SEEDS = [62, 59, 72, 67] as const
/** Where the still gulls hang under reduced motion: [x, y, 1 facing right or -1 left]; out of the sun's morning path. */
const STILL_GULLS = [[-250, outY(200), 1], [1700, outY(90), -1]] as const
/** Half units a gull climbs for each beat of a burst; it sinks as much again through the glide that follows. */
const CLIMB = 2.5
/** How large the birds are drawn: the wings are long, so the bird is drawn smaller than v26's to keep its size on screen. */
const BIRD_K = 0.62
// A gull seen from the side and a little below, flying right: the near wing reaches back and a little down, the far
// wing (a paler, shorter copy of it, mirrored about the shoulder) rises a little beyond the body, so in the glide the
// two make a long, shallow, flattened M. Each wing is one closed path of curves: from the root of the leading edge,
// a curve to the wrist and on to the tip (smooth through the wrist), and back along the trailing edge with two curves
// to its root. Every pose has the same commands, so the path morphs from one to the next (SMIL, animate d).
/** The near wing in each pose, in half units of the body, shoulder at the origin: the leading edge's root, its bend,
 * the wrist and the tip; the trailing edge's bend, its point behind the wrist, its bend and its root. Round the beat
 * from the glide: nearly edge-on mid downstroke, the bottom (below the body, curved, the tip trailing), early upstroke
 * (the wrist leading, the hand folded), opening late in the upstroke, the top (a tall V), full stretch early in the
 * downstroke, and the glide again: the downstroke is four sevenths of the beat. Last, the glide flexed. */
const WING = [
  [3, -1, -7, -5, -18, -5, -48, 5, -32, 1, -18, -1, -10, 1, -6, 2],
  [3, -1, -7, -1, -18, 0, -48, 4, -32, 3, -18, 2, -10, 2, -6, 2],
  [3, 0, -1, 6, -8, 10, -30, 17, -22, 12, -13, 9, -10, 5, -6, 2],
  [3, -1, 0, -6, -7, -9, -26, 0, -15, -3, -9, -4, -7, 0, -6, 1],
  [3, -1, 0, -8, -7, -14, -28, -24, -17, -16, -10, -10, -7, -3, -6, 1],
  [3, -1, 1, -10, -4, -18, -16, -38, -11, -26, -8, -15, -7, -4, -6, 1],
  [3, -1, -6, -9, -17, -11, -48, -12, -32, -10, -17, -7, -10, -1, -6, 2],
  [3, -1, -7, -4, -18, -3, -47, 3, -32, 0, -18, 0, -10, 1, -6, 2],
] as const
/** A pose as path data: M root Q bend wrist T tip Q bend wrist' bend root z. */
const wingD = (p: readonly number[]) => `M${nums(p[0]!, p[1]!)}Q${nums(...p.slice(2, 6))}T${nums(p[6]!, p[7]!)}Q${nums(...p.slice(8))}z`
/** A whole bird whose near wing morphs through `poses` over `dur` seconds, on and on: the far wing (a <use> of the near
 * one, so it moves with it), the body, the near wing. The near wing's own d is the glide, which is what shows if SMIL
 * does not run. */
const flapping = (id: string, poses: readonly number[], dur: number, begin = '') =>
  `<g id="o${id}"><use href="#v${id}" class="kf"/><use href="#ob"/><path id="v${id}" fill="inherit" d="${wingD(WING[0])}"><animate attributeName="d" dur="${num(dur)}s"${begin} repeatCount="indefinite" values="${poses.map(i => wingD(WING[i]!)).join(';')}"/></path></g>`
/** A gull's round of flight: bursts of two to five beats, glides of three to eleven seconds, twenty to forty seconds in
 * all; returned as the moments (in beats) it changes from one to the other, starting with a burst or a glide. */
function rounds(seed: number, b: number) {
  const rand = rng(seed)
  const glideFirst = rand() < 0.5
  const turns: number[] = []
  let n = 0
  const end = (20 + rand() * 12) / b
  while (n < end) {
    const burst = 2 + Math.floor(rand() * 4)
    const glide = R((3 + rand() * 8) / b)
    for (const k of glideFirst ? [glide, burst] : [burst, glide]) turns.push(n), (n += k)
  }
  return { glideFirst, turns, n }
}
function birds() {
  // the gull's body: slim, a head and a hint of bill, a short tail; in half units like the wings
  const body = '<path id="ob" fill="#36424f" d="M-14.8 1L-11.6-.6Q-2-2.4 6.6-1.8Q9-3.2 11.2-2.4L15.2-1.4L11.4-.4Q8.8 1.2 6.6 1.4Q-2 2.8-11.6 1.6z"/>'
  /** The gulls' four phases of the beat (a quarter apart), and the flock's two (a half apart), as SMIL begins and CSS delays. */
  const phase = (k: number) => +(-k * BEAT_S / 4).toFixed(2)
  const flockPhase = (k: number) => +(-k * FLOCK_BEAT / 2).toFixed(2)
  const poses = [0, 1, 2, 3, 4, 5, 6, 0]
  // the glide: both wings flex slowly; then a beating gull for each phase, and a beating small bird for each of its two
  const defs = `<defs>${flapping('g', [0, 7, 0], 4.2)}${[0, 1, 2, 3].map(k => flapping(String(k), poses, BEAT_S, k ? ` begin="${short(phase(k))}s"` : '')).join('')}${[0, 1].map(k => flapping(`f${k}`, poses, FLOCK_BEAT, k ? ` begin="${short(flockPhase(k))}s"` : '')).join('')}</defs>`
  const skein = SKEIN.map(([x, y], i) => {
    const k = SKEIN_PHASE[i]!
    const { t, j } = HERD.flock[i]!
    return `<g class="bj" style="--t:${t}s;--j:-${num(j * t)}s" transform="${x || y ? `translate(${num(x * ZK)} ${num(y * ZK)}) ` : ''}scale(${num(FLOCK_SIZE * BIRD_K * ZK)})"><use class="gy"${k ? ` style="--o:${short(flockPhase(k))}s"` : ''} href="#of${k}"/></g>`
  }).join('')
  // each gull: its own rise and fall (.oy), a slow bank now and then (.gn), and its own round of bursts and glides:
  // the beating bird and the gliding one stand one above the other, far apart, and the round moves the one wanted into
  // place, always at the end of a beat, where the beat passes through the glide (the round starts with the gull's phase)
  const gulls = GULLS.map((t, i) => {
    const { glideFirst, turns, n } = rounds(ROUND_SEEDS[i]!, BEAT_S)
    // (to four places: a switch must fall within a few milliseconds of the end of a beat, where the beat is in the glide)
    const keys = turns.map(k => short(+(k / n).toFixed(4)))
    const begin = i ? ` begin="${short(phase(i))}s"` : ''
    // and on top of it, it climbs a little through each burst (CLIMB half units a beat) and sinks back through the glide
    const lift = turns.map((k, j) => ((j % 2 === 0) === glideFirst ? 0 : (turns[j + 1] ?? n) - k))
    const high = turns.map((_, j) => ((j % 2 === 0) === glideFirst ? lift[(j + turns.length - 1) % turns.length]! : 0))
    // One motion does both: the switch (the beating bird 3e3 below, out of sight, in a glide) and the climb. A switch is
    // two keyTimes at the same moment, the height just before it and just after: a moment between two equal keyTimes
    // takes the later, so the bird jumps there, and between switches it rises or sinks linearly.
    const at = (j: number, k: number) => {
      const y = ((j % 2 === 0) === glideFirst ? 3000 : 0) - (high[k % turns.length] ?? 0) * CLIMB
      return y ? `0 ${y === 3000 ? '3e3' : short(y)}` : '0'
    }
    const times = turns.flatMap((_, j) => [keys[j]!, keys[j + 1] ?? '1'])
    const vals = turns.flatMap((_, j) => [at(j, j), at(j, j + 1)])
    const round = `<animateTransform attributeName="transform" dur="${num(n * BEAT_S)}s"${begin} repeatCount="indefinite" keyTimes="${times.join(';')}" values="${vals.join(';')}"/>`
    const h = HERD.gulls[i]!
    return `<g class="gf${i}"><g class="oy" style="--t:${t}s;--j:-${num(h.j * 2 * t)}s;--d:-${num(h.d * 23)}s" transform="scale(${num(GULL_SIZE * BIRD_K * ZK)})"><g>${round}<use class="gy"${i ? ` style="--o:${short(phase(i))}s"` : ''} href="#o${i}"/><use href="#og" y="-3e3"/></g></g></g>`
  }).join('')
  // Under reduced motion the beating birds (whose wings SMIL morphs, which no stylesheet can stop) are not drawn at all
  // (.bm), and two gulls hang still in the clear strips instead (.bq): a glide drawn once, nothing animated.
  const still = `<g id="oq"><use href="#wq" class="kf"/><use href="#ob"/><path id="wq" fill="inherit" d="${wingD(WING[0])}"/></g>`
  const hang = STILL_GULLS.map(([x, y, f]) => `<use href="#oq" transform="matrix(${num(f * GULL_SIZE * BIRD_K * ZK)} 0 0 ${num(GULL_SIZE * BIRD_K * ZK)} ${x} ${y})"/>`).join('')
  return `<g class="bd" fill="#36424f"><defs>${body}</defs><g class="bm">${defs}<g class="fk">${skein}</g>${gulls}</g><g class="bq"><defs>${still}</defs>${hang}</g></g>`
}

/** Keyframes for a bird (or a flock) crossing the sky again and again: each crossing straight from one side to the
 * other, this way or that at random, at its own height and a little rising or falling, then a rest out of sight
 * before the next. The bird faces the way it goes (mirrored when it flies left); it jumps to its next start only
 * while out of sight. Returns the keyframes and the seconds they take. */
function flight(name: string, seed: number, passes: number, [low, high]: readonly [number, number], speed: number, [rest0, rest1]: readonly [number, number], margin: number) {
  const rand = rng(seed)
  const legs: { t: number; dur: number; from: string; to: string }[] = []
  let t = 0
  for (let k = 0; k < passes; k++) {
    const right = rand() < 0.5
    const y0 = low + rand() * (high - low)
    const y1 = y0 + (rand() - 0.5) * 90 * ZK
    const [a, b] = right ? [X0 - margin, X1 + margin] : [X1 + margin, X0 - margin]
    const dur = ((X1 - X0 + 2 * margin) / speed) * (0.85 + rand() * 0.3)
    const face = right ? ';scale:1' : ';scale:-1 1'
    legs.push({ t, dur, from: `${a}px ${R(y0)}px${face}`, to: `${b}px ${R(y1)}px${face}` })
    t += dur + rest0 + rand() * (rest1 - rest0)
  }
  const pct = (s: number) => +((s / t) * 100).toFixed(3)
  // After a crossing the bird waits out of sight, then jumps to where the next one starts. When that is on the same side
  // the jump is not needed: it may as well drift there (straight up or down, out of sight, turning round as it goes),
  // so only a jump to the other side holds still and jumps (step-end).
  const side = (p: string) => p.split('px')[0]
  const stops = legs.map((l, i) => `${pct(l.t)}%{translate:${l.from}}${pct(l.t + l.dur)}%{translate:${l.to}${side(l.to) === side(legs[(i + 1) % legs.length]!.from) ? '' : ';animation-timing-function:step-end'}}`)
  return { css: `@keyframes ${name}{${stops.join('')}100%{translate:${legs[0]!.from}}}`, seconds: R(t) }
}
// Reed plumes (Phragmites), painted once each as a marker and set on the stalks' tops by a path that is never stroked,
// so a plume costs a few characters where it stands. Each is a feathery tassel of small flat dabs laid along it, nodding
// to leeward (left), widest in its lower middle and tapering to a fine tip, the under side fuller and hanging; the body
// in e2, the light on its upper (sun) side in e4. Six kinds, from young ones standing narrow and nearly upright to old
// ones nodding and trailing in the wind (a clump takes one of each age: see reeds).
// (A marker costs the player a little each time it is drawn, so each plume is two strokes, of flat-ended dabs.) Written at PS times the size they
// show at, in whole units.
const PS = 2
// [length, nod at the tip (radians), half width, how loose its end hangs, rows of dabs]
const PLUME_KINDS = [
  [62, 0.25, 10, 0, 6],
  [68, 0.45, 13, 0.1, 6],
  [72, 0.7, 16, 0.3, 7],
  [76, 0.9, 17, 0.5, 7],
  [78, 1.1, 15, 0.8, 6],
  [82, 1.3, 13, 1, 6],
] as const
const PLUMES = PLUME_KINDS.map(([L, nod, W, loose, n], q) => {
  const r = rng(7700 + q * 31)
  /** A point on the plume: u along it (0 at the stalk's top, 1 at the tip), f across it (-1 the upper side, 1 the
   * under side, at its full width there). */
  const at = (u: number, f: number) => {
    let [x, y, a] = [0, 8, 0.04]
    const k = 24
    for (let j = 1; j <= Math.round(k * u); j++) {
      a = 0.04 - nod * ((j - 0.5) / k) ** 1.3
      x += (Math.sin(a) * L) / k
      y -= (Math.cos(a) * L) / k
    }
    // widest a third of the way up, the under side fuller; a loose plume's end trails wider below
    const o = f * W * 2.2 * u ** 0.6 * (1 - u) ** (0.9 - 0.5 * loose) * (f > 0 ? 1 : 0.6)
    return [x - o * Math.cos(a), y - o * Math.sin(a)] as const
  }
  const d = new Dabs().order('e2', 'e4').ends(PS)
  const dab = (slot: string, u: number, len: number, f1: number, f2: number) => {
    const [x, y] = at(Math.max(0, u - len / 2), f1)
    const [x2, y2] = at(Math.min(1, u + len / 2), f2)
    d.add(slot, (x * PS) / 2, (y * PS) / 2, ((x2 - x) * PS) / 2, ((y2 - y) * PS) / 2)
  }
  // the body: short dabs laid along the plume in rows, as many across as its width takes, the under ones hanging out
  // a little, and more so toward a loose plume's end; one on the stalk's top joins them to it
  dab('e2', 0.04, 0.12, 0, 0)
  for (let j = 0; j < n; j++) {
    const u = 0.1 + (0.86 * (j + 0.3 + r() * 0.4)) / n
    const across = Math.max(1, Math.round((W * 2.2 * u ** 0.6 * (1 - u) ** 0.9) / 5))
    for (let c = 0; c < across; c++) {
      const f = across === 1 ? r() * 0.4 - 0.2 : -0.85 + (1.75 * (c + r() * 0.6 + 0.2)) / across - 0.15 / across
      dab('e2', u, 0.16 + r() * 0.06, f, f + (f > 0 ? 0.25 + 0.5 * loose * u : -0.1))
    }
  }
  // the light on the upper (sun) side; not on the narrow young plumes, which saves the player a stroke for each
  if (q > 1) for (let j = 0; j < 3; j++) dab('e4', 0.14 + 0.22 * j + r() * 0.05, 0.1, -0.55 - r() * 0.3, -0.6)
  return `<marker id="rp${q}">${d.svg(0)}</marker>`
})
const PLUME_DEFS = `<defs>${PLUMES.join('')}</defs>`
/** One clump's plumes: for each kind in use, a path through the stalks' tops that is never stroked, with a plume (its
 * marker) on each of its points; the clump's stroke width sets their size. */
function plumes(tops: [number, number][][]) {
  return tops
    .map((list, q) => {
      if (!list) return ''
      let [px, py] = [0, 0]
      const d = list.map(([x, y], j) => {
        const st = (j > 0 && x >= px ? ' ' : '') + nums(x - px, y - py)
        ;[px, py] = [x, y]
        return st
      })
      return `<path class="k${q}" d="m${d.join('')}"/>`
    })
    .join('')
}
// Reeds near the viewer at both sides, rooted below the picture's edge and standing tall out of the water, bending
// with the gusts. They stand where any window shows them: inside the sidebar's edge and the chat column's on the
// left, the chat column's and the side panel's on the right; and tall enough to show above the bottom edge even when a
// wide window crops the picture's top and bottom.
const REEDS = ([[60, 1290, 0.9], [150, 1275, 1], [215, 1300, 0.75], [1430, 1295, 0.8], [1530, 1275, 1], [1640, 1290, 0.85], [1760, 1270, 1]] as const).map(
  ([x, y, k]) => [outX(x), outY(y), k] as const,
)
function reeds(rand: () => number) {
  // v37's finer brushwork, from its own stream: a few narrow leaves, some bent over. The plumes' kinds, from another.
  // (Nothing here draws from rand but what v42 drew, in the same order, so all that is drawn after keeps its place.)
  const fine = rng(6151)
  const pf = rng(4409)
  // the clump as a painter would set it down, from a stream of its own: stalks bowed this way and that, some crossing,
  // a rhythm of tall and short, every fourth stalk thinner and lit (another colour), now and then a blade snapped and
  // hanging
  const bend = rng(5303)
  return PLUME_DEFS + REEDS.map(([cx, cy, k], i) => {
    const leaves: string[] = []
    // each path's moves written relative to where the pen stopped, when that is shorter
    const pen = { stalk: [0, 0], lit: [0, 0], blade: [0, 0] }
    const to = (k: keyof typeof pen, x: number, y: number, rest: string, [ex, ey]: readonly number[]) => {
      const [px, py] = pen[k]
      const abs = `M${pair(x, y)}`
      const rel = `m${pair(x - px!, y - py!)}`
      pen[k] = [x + ex!, y + ey!]
      return (rel.length < abs.length && px !== 0 ? rel : abs) + rest
    }
    let stalk = ''
    let lit = ''
    const tops: [number, number][][] = []
    let blade = ''
    const n = R(14 * k) + 4
    // drawn ZK larger than v23 drew them, so they keep their size on screen
    const s = k * ZK
    for (let j = 0; j < n; j++) {
      const bx = cx + (rand() - 0.5) * 90 * s
      const bow = (bend() - 0.5) * 70 * s
      const h = (300 + rand() * 170) * s * (bend() < 0.3 ? 0.7 + bend() * 0.15 : 1)
      const lean = ((rand() - 0.5) * 50 * k - 8) * ZK
      // (written from the clump's root in a translated group they would take fewer digits, but Chromium rasterises a
      // still, translated group a little differently, so they stay in the canvas's own units)
      // (stalks, blades and leaves are flat-ended, which the player draws for less: their ends are below the picture's
      // edge, under a plume, or narrow enough that the eye cannot tell)
      const way = j % 4 === 2 ? 'lit' : 'stalk'
      const st = to(way, R(bx), cy, `q${nums(R(lean * 0.2 + bow), R(-h * 0.5), R(lean), R(-h))}`, [R(lean), R(-h)])
      if (way === 'lit') lit += st
      else stalk += st
      if (rand() < 0.6) {
        // which plume: three of the six kinds for each clump (a young one, a full one, a loose one)
        const q = (i + Math.floor(pf() * 3) * 2) % PLUMES.length
        ;(tops[q] ??= []).push([R(bx + lean), R(cy - h)])
      }
      if (rand() < 0.7) {
        const side = rand() < 0.5 ? -1 : 1
        const end = [R(side * (50 + rand() * 30) * s), R(-h * (0.45 + rand() * 0.15))] as const
        if (bend() < 0.12) {
          // snapped two thirds of the way up, its end hanging down and out
          const [kx, ky] = [R(end[0] * 0.75), R(end[1] * 0.68)]
          const [fx, fy] = [R(side * (22 + bend() * 20) * s), R((30 + bend() * 25) * s)]
          blade += to('blade', R(bx), cy, `q${nums(R(side * 25 * s), R(-h * 0.3), kx, ky)}l${nums(fx, fy)}`, [kx + fx, ky + fy])
        } else blade += to('blade', R(bx), cy, `q${nums(R(side * 25 * s), R(-h * 0.35), ...end)}`, end)
      }
    }
    for (let j = 0; j < 3; j++) {
      const [bx, h, side] = [R(cx + (fine() - 0.5) * 80 * s), (190 + fine() * 150) * s, fine() < 0.5 ? -1 : 1]
      // (a bent leaf's tip hangs lower than its middle)
      const bent = fine() < 0.5
      leaves.push(`M${pair(bx, cy)}q${nums(R(side * (12 + fine() * 14) * s), R(-h * 0.7), R(side * (bent ? 70 : 34) * s), R(-h * (bent ? 0.62 : 1)))}`)
    }
    return `<g class="x${i}" stroke-width="${num(s / PS)}"><path class="e3 bu" stroke-width="${R(45 * s) / 10}" d="${blade}"/><path class="e1 bu" stroke-width="${R(32 * s) / 10}" d="${stalk}"/><path class="ew bu" stroke-width="${R(22 * s) / 10}" d="${leaves.join('')}${lit}"/>${plumes(tops)}</g>`
  }).join('')
}

// ---------- v37: the near shore and the water by the reeds, in the clear strips ----------
/** Width of a piece of shore drawn once and set down along the water's edge (the shore is level, at SHORE). */
const BAND = 160
/** Where the pieces go, [x, which, 1 or -1 when mirrored]: across the left strip and either side of it, and along the
 * right hill's foot; two pieces, each also set down mirrored, so neighbours never match. */
const BAND_AT = [[-150, 0, 1], [10, 1, -1], [1450, 1, 1], [1610, 0, -1], [1770, 1, -1], [1930, 0, 1]] as const
// Close up, where the woods meet the water: wet dark sand at the edge, stones (lit on top, a cap of moss or snow on
// some), pale sand, roots, grass, and the leaves of the trees above hanging out over the water, with their reflection
// in short level strokes. Static. (Each colour is one path, and few pieces are set down: every path of a <use> copy is
// drawn again, and that is what a frame costs.)
function shoreBand() {
  const r = rng(3907)
  const ink = (c: string, w: number, d: Dab[], more = '') => `<path stroke="${c}" stroke-width="${w}"${more} d="${dabPath(d)}"/>`
  let defs = ''
  for (let v = 0; v < 2; v++) {
    const [wet, dark, light]: [Dab[], Dab[], Dab[]] = [[], [], []]
    const ground = new Dabs().order('g2', 'g1')
    // (t4 is the woods' shade, snow in shadow in winter)
    const leaf = new Dabs().order('c2', 't4', 't2', 't3')
    const shade = new Dabs()
    const at = () => R(r() * BAND)
    for (let x = r() * 9; x < BAND; x += 6 + r() * 12) wet.push([R(x), 2, R(1 + r() * 4), 0])
    for (let k = 0; k < 12; k++) ground.add('g2', at(), R(r() * 2) - 1, R(1 + r() * 3), 0)
    // stones in twos and threes, of a few sizes, half in the water
    for (let k = 0; k < 4; k++) {
      const x0 = at()
      for (let m = 1 + R(r() * 2); m > 0; m--) {
        const [x, y, w] = [R(x0 + (r() - 0.5) * 10), R(r() * 3) - 1, R(r() * r() * 3)]
        dark.push([x, y, w, 0])
        light.push([x - (w > 1 ? 1 : 0), y - 1, Math.max(0, w - 1), 0])
        if (r() < 0.4) ground.add('g1', x, y - 2, 0, 0)
      }
    }
    for (let k = 0; k < 3; k++) wet.push([at(), -4 - R(r() * 3), R((r() - 0.5) * 5), R(4 + r() * 2)])
    for (let k = 0; k < 5; k++) ground.add('g1', at(), -1, R((r() - 0.5) * 3), -R(3 + r() * 3))
    // the leaves hanging out over the water, darker underneath, and their reflection just below in short level strokes
    for (let c = 0; c < 5; c++) {
      const cx = r() * BAND
      for (let k = 5 + R(r() * 3); k > 0; k--) {
        const [y, p] = [-8 + r() * 11, r()]
        leaf.add(y > 0 ? (p < 0.25 ? 'c2' : 't4') : p < 0.15 ? 't4' : p < 0.75 ? 't2' : 't3', cx + (r() - 0.5) * 14, y, (r() - 0.5) * 5, 1 + r() * 2)
      }
      for (let k = 0; k < 2; k++) shade.add('t4', cx - 6 + r() * 6, 5 + k * 3 + r() * 2, 4 + r() * 6, 0)
    }
    defs += `<g id="b${v}">${ink('#38362f', 1.3, wet)}${ink('#5e5a52', 3.2, dark)}${ink('#d2cbb8', 1.5, light)}${ground.svg(1.6)}<g class="ra">${leaf.svg(0)}<g stroke-opacity=".4">${shade.svg(0)}</g></g></g>`
  }
  return `<defs>${defs}</defs>${BAND_AT.map(([x, v, f]) => `<use href="#b${v}" ${f < 0 ? `transform="matrix(-1 0 0 1 ${x + BAND} ${SHORE})"` : `x="${x}" y="${SHORE}"`}/>`).join('')}`
}

/** Lily pads by the reeds, [x, y] in canvas units: loose beds each side, where the user's window shows the water
 * (it shows down to about y 1180). */
const PAD_BEDS = [[-40, 1090], [70, 1140], [1560, 1120], [1700, 1080], [1850, 1135], [1960, 1100]] as const
function lilies() {
  const r = rng(7121)
  let pads = ''
  const [lit, flower]: [Dab[], Dab[]] = [[], []]
  let [px, py] = [0, 0]
  for (const [bx, by] of PAD_BEDS) {
    for (let k = 2 + R(r() * 2); k > 0; k--) {
      const [cx, cy] = [R(bx + (r() - 0.5) * 110), R(by + (r() - 0.5) * 50)]
      // larger nearer the viewer, and flattened by the low view across the water
      const rx = R((11 + (cy - 1000) / 14) * (0.75 + r() * 0.5))
      const ry = Math.max(2, R(rx * 0.3))
      // the notch: a wedge cut from the middle to the rim, turned any way; the rim is one arc the long way round
      const t = r() * 2 * Math.PI
      const [ax, ay, ex, ey] = [R(rx * Math.cos(t)), R(ry * Math.sin(t)), R(rx * Math.cos(t - 0.5)), R(ry * Math.sin(t - 0.5))]
      pads += `${pads ? `m${pair(cx - px, cy - py)}` : `M${pair(cx, cy)}`}l${nums(ax, ay)}a${rx} ${ry} 0 11${nums(ex - ax, ey - ay)}z`
      ;[px, py] = [cx, cy]
      lit.push([R(cx - rx * 0.6), R(cy - ry * 0.5), R(rx * 0.55), 0])
      if (r() < 0.35) flower.push([cx - 2, cy - 2, 3, 0], [cx - 1, cy - 4, 1, 0])
    }
  }
  return `<path class="lp" d="${pads}"/><g stroke-width="1.4"><path class="lh" d="${dabPath(lit)}"/></g><g stroke-width="3"><path class="lf" d="${dabPath(flower)}"/></g>`
}

// The gust on the water: the face of the lake darkens a little where a gust ruffles it. One gradient, repeating every
// GUST_SPAN, its shade following the gust's curve; it slides left with the gust's front, so it is over each x when the
// woods and reeds above it bend.
function paw() {
  return ['', ''] as const
}

function build() {
  const rand = rng(20261116)
  const starDots = stars(rand)
  const sunDabs = sun(rand)
  const cloudDabs = clouds(rng(4417))
  for (let i = 0; i < OLD_CLOUD_DRAWS; i++) rand()
  const far = farRidge(rand)
  const wood = woods(rand)
  const mids = midRidges()
  const lake = water(rand)
  const snowFlakes = snow(rand)
  const reedBeds = reeds(rand)
  const morning = mist(rng(8123))
  const shoreDetail = shoreBand()
  const catsPaw = paw()
  const sky = `x="${X0}" y="${Y0}" width="${X1 - X0}" height="${SHORE + 10 - Y0}"`
  const all = `x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"`
  const lake0 = `x="${X0}" y="${SHORE}" width="${X1 - X0}" height="${Y1 - SHORE}"`
  // dawn and dusk glow low in the east, flattened along the horizon; the west's is the same, mirrored
  const glow = (id: string, cx: number) =>
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${HZ}" r="${R(1000 * ZK)}" gradientTransform="matrix(1 0 0 .5 0 ${HZ / 2})"><stop stop-color="#ffb46a" stop-opacity=".75"/><stop offset=".3" stop-color="#f49a7e" stop-opacity=".4"/><stop offset=".65" stop-color="#b08ab8" stop-opacity=".12"/><stop offset="1" stop-color="#b08ab8" stop-opacity="0"/></radialGradient>`
  // Back to front: the daylit picture (sky, sun, clouds, birds, land, lake, boat, reeds, overcast, snow); one veil of
  // dusk and night over all of it, deeper toward the top of the sky; above the veil, kept to the sky by the skyline,
  // the low glow of dawn and dusk and the moon, which sets behind the trees; the stars; the moon's path on the water
  // and the boat's lantern, which shine through the night; a dimmer for a dark window.
  return `<defs><clipPath id="wc"><rect x="${X0}" y="${SHORE}" width="${X1 - X0}" height="${Y1 - SHORE}"/></clipPath><linearGradient id="sg" x2="0" y2="1"><stop class="q1"/><stop class="q2" offset=".55"/><stop class="q3" offset="1"/></linearGradient><radialGradient id="gl"><stop stop-color="#ffd37a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd37a" stop-opacity="0"/></radialGradient>${glow('ge', ARC_X[0])}<clipPath id="sk"><path clip-rule="evenodd" d="M${X0 - 10} ${Y0 - 10}H${X1 + 30}V${Y1 + 10}H${X0 - 10}z${skyline}"/></clipPath><linearGradient id="nt" x2="0" y2="1"><stop stop-color="${NIGHT}" stop-opacity=".6"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="0"/></linearGradient><linearGradient id="wg" x2="0" y2="1"><stop class="q3" stop-opacity=".5"/><stop class="q3" offset=".3" stop-opacity="0"/><stop offset=".55" stop-color="#0c2550" stop-opacity="0"/><stop offset="1" stop-color="#0c2550" stop-opacity=".22"/></linearGradient><radialGradient id="yg" gradientUnits="userSpaceOnUse" cx="${ARC_X[0]}" cy="${SHORE}" r="${R(1000 * ZK)}" gradientTransform="matrix(1 0 0 .3 0 ${R(SHORE * 0.7)})"><stop stop-color="#ffb46a" stop-opacity=".7"/><stop offset=".3" stop-color="#f49a7e" stop-opacity=".38"/><stop offset=".7" stop-color="#b08ab8" stop-opacity=".1"/><stop offset="1" stop-color="#b08ab8" stop-opacity="0"/></radialGradient><radialGradient id="hz" gradientUnits="userSpaceOnUse" cx="930" cy="${SHORE - 6}" r="760" gradientTransform="matrix(1 0 0 .07 0 ${R((SHORE - 6) * 0.93)})"><stop class="q3" stop-opacity=".75"/><stop class="q3" offset=".6" stop-opacity=".3"/><stop class="q3" offset="1" stop-opacity="0"/></radialGradient><linearGradient id="ft" gradientUnits="userSpaceOnUse" y1="${SHORE - 80}" x2="0" y2="${SHORE + 4}"><stop class="qf" stop-opacity="0"/><stop class="qf" offset="1" stop-opacity=".2"/></linearGradient><radialGradient id="mg"><stop stop-color="#eef1f6" stop-opacity=".75"/><stop offset=".55" stop-color="#eef1f6" stop-opacity=".35"/><stop offset="1" stop-color="#eef1f6" stop-opacity="0"/></radialGradient>${catsPaw[0]}<radialGradient id="hg"><stop offset=".3" stop-color="${SHADE}"/><stop offset="1" stop-color="${SHADE}" stop-opacity="0"/></radialGradient><radialGradient id="mh"><stop stop-color="#eef2fa" stop-opacity=".5"/><stop offset=".45" stop-color="#eef2fa" stop-opacity=".14"/><stop offset="1" stop-color="#eef2fa" stop-opacity="0"/></radialGradient></defs>
<rect fill="url(#sg)" ${sky}/>${sunDabs}${cloudDabs}${birds()}
<g>${far}${mids}${wood}</g>
<rect class="wa" ${lake0}/><rect fill="url(#wg)" ${lake0}/>
${lite ? '' : `<g clip-path="url(#wc)"><g class="wr"><g transform="matrix(1 0 0 -0.92 0 ${R(SHORE * 1.92 + 2)})" opacity=".38"><use href="#fq"/><use href="#fp"/>${MIDS.map((m, i) => `<use href="#m${i}" class="gr"/><use href="#m${i}" class="fr" opacity="${num(m.haze)}"/>`).join('')}<use href="#ga" class="gr"/><use href="#gb" class="gr"/>${blots}</g></g></g>`}
${lake}${catsPaw[1]}${shoreDetail}<g clip-path="url(#wc)"><g class="li">${HILL_SHADE.map(([cx, rx, ry]) => `<ellipse class="hs" cx="${cx}" cy="${SHORE}" rx="${rx}" ry="${ry}" fill="url(#hg)"/>`).join('')}</g></g>${rises()}
<rect fill="url(#hz)" x="${X0}" y="${SHORE - 60}" width="${X1 - X0}" height="110"/><rect class="ge" fill="url(#yg)" ${lake0}/><rect class="gw" fill="url(#yg)" transform="matrix(-1 0 0 1 ${ARC_X[0] + ARC_X[3]} 0)" ${lake0}/>${morning}${lilies()}
${boat()}
${reedBeds}
<rect class="ov" ${all}/>${snowFlakes}
<g class="nq"><rect class="nk" ${all}/></g><rect class="nt" fill="url(#nt)" x="${X0}" y="${Y0}" width="${X1 - X0}" height="${HZ - Y0}"/><g clip-path="url(#sk)"><rect class="ge" fill="url(#ge)" ${sky}/><rect class="gw" fill="url(#ge)" transform="matrix(-1 0 0 1 ${ARC_X[0] + ARC_X[3]} 0)" ${sky}/><g class="mx"><g class="mo"><g class="li" transform="scale(${ZK})">${MOON}</g></g></g></g>${lite ? '' : starDots}${fireflies()}
<g transform="translate(-${SUN_X} 0)"><g class="gm"><use class="w3" href="#gz"/></g></g><g class="bt"><g class="bx"><g class="bb"><g class="by"><g class="nt"><path fill="${mix('#c24e26', NIGHT, 0.72)}" d="M-46-4Q-30 12 0 12Q32 12 48-6Q0 4-46-4z"/><path stroke="${mix('#2c3d5c', NIGHT, 0.72)}" stroke-width="7" d="M-11.5-3Q-12.5-11-8.5-16M-12-1.5Q-6-8-.5-9.6L3-1"/></g><g class="lq"><circle cx="-40" cy="-14" r="16" fill="url(#gl)"/><path stroke="#3b2a1e" stroke-width="1.5" d="M-38 -4V-12"/><rect x="-43.5" y="-18" width="7" height="7" rx="1.5" fill="#ffd37a"/><g class="wr"><path stroke="#ffd37a" stroke-width="1.6" opacity=".55" d="M-44 16h8M-42 20.5h4"/></g></g></g></g></g></g>`
}

/** Stands in the cached geometry for the moon, which is drawn afresh for each day's phase. */
const MOON = '<g id="moon"/>'

/** The moon at phase p (0 new, 0.5 full): a faint halo and the lit part (the dark limb is left out: a pale disc round a gibbous moon read as a ring), its bright
 * side turned `tilt` degrees from straight right (waxing) or left (waning). */
function moon(p: number, tilt: number) {
  const r = 19
  const k = Math.abs(Math.cos(2 * Math.PI * p))
  const waxing = p < 0.5
  const crescent = Math.abs(p - 0.5) > 0.25
  const lit = (1 - Math.cos(2 * Math.PI * p)) / 2
  return `<circle r="48" fill="url(#mh)" opacity="${num(0.3 + 0.7 * lit)}"/><path fill="#f3eed8" transform="rotate(${R(tilt)})" d="M0-${r}A${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r}A${(k * r).toFixed(1)} ${r} 0 0 ${waxing !== crescent ? 1 : 0} 0-${r}z"/>`
}

// ---------- the day on the local clock ----------

/** The veil over the picture by the sun's height: [degrees, colour, opacity]. Dark blue by night, violet at dusk,
 * warm in the low sun, nothing by day. */
const VEIL = [[-12, NIGHT, 0.72], [-7, '#1a2250', 0.58], [-3, '#4a3a6a', 0.35], [1, '#d06a4a', 0.15], [6, '#ff9a40', 0.08], [12, '#ff9a40', 0]] as const
const veil = (e: number, rows: readonly (readonly [number, string, number])[], lift = 0) => {
  let i = 1
  while (i < rows.length - 1 && e > rows[i]![0]) i++
  const [e0, c0, o0] = rows[i - 1]!
  const [e1, c1, o1] = rows[i]!
  const f = Math.max(0, Math.min(1, (e - e0) / (e1 - e0)))
  return `fill:${mix(c0, c1, f)};opacity:${num(o0 + (o1 - o0) * f - lift)}`
}
const num = (v: number) => String(+v.toFixed(2)).replace(/^0\./, '.').replace(/^-0\./, '-.')

/** Keyframes over the 24 hours from a value sampled every `step` minutes, keeping only the samples where it turns. */
/** `hidden`: whether a value leaves the thing out of sight (under the lake, outside the sky's clip, or wholly
 * transparent); between two such samples, whatever lies between them is out of sight too, so a run of them keeps only
 * its first and last. */
function dayFrames(name: string, step: number, at: (minute: number) => string, hidden?: (v: string) => boolean) {
  const pts: [number, string][] = []
  // (sampled on a grid of whole or half percents of the day, so the keyframes' offsets are short)
  for (let k = 0; k * step <= 1440; k++) pts.push([k * step, at(k * step)])
  // keep only the samples a straight run between the kept ones would miss by more than a pixel and a half (or .015
  // of opacity, or 3 of 255 in a colour's channel)
  const parts = (v: string) => v.replace(/#(\w\w)(\w\w)(\w\w)/g, (_, r, g, b) => `#${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)}`)
  const shape = (v: string) => parts(v).replace(/-?[\d.]+/g, '0')
  const nums = (v: string) => (parts(v).match(/-?[\d.]+/g) ?? []).map(Number)
  const fits = (a: number, b: number) => {
    const [ma, va] = pts[a]!
    const [mb, vb] = pts[b]!
    if (shape(va) !== shape(vb)) return false
    const [na, nb] = [nums(va), nums(vb)]
    for (let k = a + 1; k < b; k++) {
      const [mk, vk] = pts[k]!
      if (shape(vk) !== shape(va)) return false
      const f = (mk - ma) / (mb - ma)
      // (a colour comes first where there is one, as in the veil's)
      const tol = (n: number, i: number) => (va.includes('#') && i < 3 ? 3 : Math.abs(n) >= 2 ? 1.5 : 0.015)
      if (nums(vk).some((n, i) => Math.abs(na[i]! + (nb[i]! - na[i]!) * f - n) > tol(n, i))) return false
    }
    return true
  }
  const keep = [0]
  for (let j = 2; j < pts.length; j++) if (!fits(keep[keep.length - 1]!, j)) keep.push(j - 1)
  keep.push(pts.length - 1)
  if (hidden) {
    const out = keep.filter((k, i) => i === 0 || i === keep.length - 1 || !(hidden(pts[keep[i - 1]!]![1]) && hidden(pts[k]![1]) && hidden(pts[keep[i + 1]!]![1])))
    keep.splice(0, keep.length, ...out)
  }
  const groups = new Map<string, string[]>()
  for (const i of keep) {
    const [m, v] = pts[i]!
    groups.set(v, [...(groups.get(v) ?? []), pc(m / 14.4, 2)])
  }
  return `@keyframes ${name}{${[...groups].map(([v, at]) => `${at.join(',')}{${v}}`).join('')}}`
}

/** Everything that keeps the local clock: the sun's and moon's paths, their glitter on the lake, the veils of dusk and
 * night, the dawn and dusk glow, stars, birds, the lantern; and the moon drawn for today's phase. */
function dayCss(now: number, tz: number) {
  const day = dayAt(now, tz)
  const minute = day.second / 60
  // A body's spot at a minute; once it is out of sight it waits well under the ground below where it was last seen
  // (or will next be), so it never sweeps across the picture on its way round.
  const spot = (at: (m: number) => [number, number], arc: (m: number) => number, m: number): [number, number] => {
    const seen = (t: number) => at(t)[0] > -10
    const el = at(m)[0]
    if (seen(m)) return [R(skyX(arc(m))), R(skyY(el))]
    let u = arc(m)
    for (let d = 30; d <= 720; d += 30) {
      if (seen(m - d)) { u = arc(m - d); break }
      if (seen(m + d)) { u = arc(m + d); break }
    }
    // (to the nearest hundred: it is under the ground, and fewer different spots make shorter keyframes)
    return [R(skyX(u) / 100) * 100, 1100]
  }
  const sunAt = (m: number) => spot(day.sun, day.sunArc, m)
  const moonAt = (m: number) => spot(day.moon, day.moonArc, m)
  const sunEl = (m: number) => day.sun(m)[0]
  const moonEl = (m: number) => day.moon(m)[0]
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  // a glitter that is not shown keeps to the nearest hundred, which makes for fewer keyframes
  const glitter = (x: number, o: number) => `translate:${o > 0 ? x : R(x / 100) * 100}px;opacity:${num(o)}`
  const glow = (m: number, east: boolean) =>
    `opacity:${num((day.sun(m)[1] < 180) === east ? ramp(sunEl(m), [[-10, 0], [-5, 0.6], [0, 1], [5, 0.45], [12, 0]]) : 0)}`
  // out of sight: the sun at 1100 lies under the lake, the moon there outside the sky's clip; a glitter at no opacity
  const under = (v: string) => v.endsWith(' 1100px')
  const unlit = (v: string) => v.endsWith('opacity:0')
  const rules: [string, number, (m: number) => string, ((v: string) => boolean)?][] = [
    ['sx', 14.4, m => `translate:${sunAt(m).join('px ')}px`, under],
    ['mx', 14.4, m => `translate:${moonAt(m).join('px ')}px`, under],
    ['gs', 14.4, m => glitter(sunAt(m)[0], ramp(sunEl(m), [[0, 0], [3, 0.6], [10, 1]])), unlit],
    ['gm', 14.4, m => glitter(moonAt(m)[0], 0.85 * clamp(moonEl(m) / 6) * clamp((-3 - sunEl(m)) / 6)), unlit],
    ['nk', 7.2, m => veil(sunEl(m), VEIL)],
    ['nt', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-12, 1], [-4, 0]]))}`],
    ['ge', 7.2, m => glow(m, true)],
    ['gw', 7.2, m => glow(m, false)],
    ['sv', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-14, 1], [-10, 0.7], [-4, 0]]))}`],
    ['mo', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-6, 1], [4, 0.55]]))}`],
    ['sr', 7.2, m => `opacity:${num(ramp(sunEl(m), [[0, 0.85], [4, 0.5], [12, 0]]))}`],
    // the glitter goes orange with the sun, the clouds' lit sides peach, and mist lies on the water at first light
    ['gk', 7.2, m => `opacity:${num(ramp(sunEl(m), [[1, 0.9], [5, 0.7], [11, 0]]))}`],
    ['cp', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-9, 0], [-4, 0.7], [2, 0.85], [7, 0.5], [13, 0]]))}`],
    ['ms', 7.2, m => `opacity:${num(day.sun(m)[1] < 180 ? ramp(sunEl(m), [[-7, 0], [-4, 0.9], [2, 0.85], [8, 0]]) : 0)}`],
    ['bd', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-4, 0], [0, 1]]))}`],
    ['lq', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-4, 1], [2, 0]]))}`],
    // the light engine: the sheets on the hills and the rims on the boat, the boat's and the hills' shade, the clouds' bellies
    ['le', 14.4, m => `opacity:${num(lightAt(day, m).east)}`],
    ['lw', 14.4, m => `opacity:${num(lightAt(day, m).west)}`],
    ['hs', 14.4, m => shoreShade(sunEl(m), day.sun(m)[1])],
    ['cu', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-7, 0], [-3, 0.6], [1, 0.8], [5, 0.5], [10, 0]]))}`],
    // fireflies only once it is dark
    ['ff', 7.2, m => `opacity:${num(ramp(sunEl(m), [[-9, 1], [-6, 0]]))}`],
  ]
  // one rule gives them all the day's timing, each its own keyframes by --n (each class sets its own, so what a
  // child inherits from a parent's --n is always overridden where it is used)
  let css = `${rules.map(([name]) => `.${name}`).join(',')}{animation:var(--n) 86400s linear -${R(day.second)}s infinite}`
  for (const [name, step, at, hidden] of rules) css += `${dayFrames(name, step, at, hidden)}.${name}{${at(minute)};--n:${name}}`
  // the moon's bright side turned toward the sun, within reason
  const [sx, sy] = [skyX(day.sunArc(minute)), skyY(sunEl(minute))]
  const [mx, my] = [skyX(day.moonArc(minute)), skyY(moonEl(minute))]
  let tilt = (Math.atan2(sy - my, sx - mx) * 180) / Math.PI - (day.phase < 0.5 ? 0 : 180)
  tilt = ((tilt + 540) % 360) - 180
  return { css, // (kept near upright: tipped far over, a gibbous moon reads as a bowl, not as a moon)
    moon: moon(day.phase, Math.max(-18, Math.min(18, tilt))) }
}

export type SceneOptions = {
  /** Seconds since the epoch, to place the year where it was left. */
  now: number
  /** For previews: a point of the year (0 to 1) to start at, weather included. */
  at?: number
  /** A season to hold still at, or undefined to let the year turn. */
  pinned?: Season
  /** Weather to hold, or undefined to let it come and go with the year (a clear day when a season is pinned). */
  weather?: Weather
  /** Seconds for one whole year; YEAR when absent. */
  year?: number
  /** full: the painting; lite: a lighter painting; test: only sky, lake and the boat, to tell a heavy scene from a window that draws no motion. */
  variant?: 'full' | 'lite' | 'test'
  /** Minutes the local clock runs ahead of UTC, for the sun and moon; the runtime's own zone when absent. */
  tz?: number
}

export function lakeScene({ now, at: startAt, pinned, weather, year: Y = YEAR, variant = 'full', tz }: SceneOptions): string {
  let geometry = geometries.get(variant)
  if (geometry === undefined) {
    lite = variant === 'lite'
    geometry = variant === 'test' ? buildTest() : build()
    lite = false
    geometries.set(variant, geometry)
  }
  const at = pinned !== undefined ? SEASON_CENTER[pinned] : startAt ?? (now % Y) / Y
  const delay = -(at * Y).toFixed(1)
  const run = pinned !== undefined ? ' paused' : ''
  const year = (name: string) => `animation:${name} ${Y}s linear ${short(delay)}s infinite${run}`
  const pct = at * 100
  /** A negative delay that puts a loop of this many seconds where the clock is, so a reload does not restart it. */
  const lap = (seconds: number) => short(-(now % seconds).toFixed(1))
  // weather that holds still: asked for, or a clear day when a season is pinned
  const held = weather ?? (pinned !== undefined ? 'clear' : undefined)
  // the test picture is only sky, lake and boat: it needs none of the day's keyframes
  const day = variant === 'test' ? { css: '', moon: '' } : dayCss(now, tz ?? -new Date(now * 1000).getTimezoneOffset())

  // every colour slot paints the blend of its four colours that the root's weights call for (see SEASON_MIX); the root
  // holds the weights for this moment before it moves. (!important: a slot must outrank path:not([fill]){fill:none}, as
  // its animation used to.)
  const [wp, wq, wr] = seasonWeights(at)
  let css = `svg{--p:${wp}%;--q:${wq}%;--r:${wr}%;${year('yr')}}${seasonKeyframes()}`
  const slotsOf = (prop: Slot['prop']) => Object.keys(SLOTS).filter(k => SLOTS[k]!.prop === prop).map(k => `.${k}`).join(',')
  for (const prop of ['stroke', 'fill'] as const) css += `${slotsOf(prop)}{${prop}:${SEASON_MIX}!important}`
  // (the stops: the same four colours as keyframes, var(--a) .. var(--d), on each stop; and the colour before it moves)
  css += `${slotsOf('stop-color')}{${year('yc')}}@keyframes yc{0%,18%,100%{stop-color:var(--a)}25%,43%{stop-color:var(--b)}50%,68%{stop-color:var(--c)}75%,93%{stop-color:var(--d)}}`
  for (const [k, s] of Object.entries(SLOTS)) {
    css += `.${k}{${s.day.map((c, i) => `--${'abcd'[i]}:${shortHex(c)}`).join(';')}${s.prop === 'stop-color' ? `;stop-color:${shortHex(colourAt(s.day, at))}` : ''}}`
  }
  css += `${trackKeyframes('wfs', FIREFLY_YEAR)}.fs{opacity:${short(+trackAt(FIREFLY_YEAR, pct).toFixed(2))};${year('wfs')}}`
  for (const [k, t] of Object.entries(WEATHER)) {
    css += held !== undefined ? `.${k}{opacity:${short(HELD[held][k]!)}}` : `${trackKeyframes(`w${k}`, t)}.${k}{opacity:${short(+trackAt(t, pct).toFixed(2))};${year(`w${k}`)}}`
  }

  css += `path:not([fill]){fill:none}path{stroke-linecap:round}.bu{stroke-linecap:butt}.ov{fill:#7d8896}
${([['cd', DRIFT.high], ['ce', DRIFT.low], ['md', DRIFT.mist]] as const).map(([c, k]) => `.${c}{animation:cloud ${drift(k)}s linear ${lap(drift(k))}s infinite}`).join('')}@keyframes cloud{to{transform:translateX(-${X1 - X0}px)}}
.f0{animation:swayA ${FAR_SWAY[0]}s ease-in-out infinite alternate}@keyframes swayA{from{transform:translateX(-10px)}to{transform:translateX(9px)}}
.f1{animation:swayB ${FAR_SWAY[1]}s ease-in-out -5s infinite alternate}@keyframes swayB{from{transform:translateX(9px)}to{transform:translateX(-11px)}}
${DRIFT.ripple.map((share, k) => { const s = drift(share, TILE[k]!); return `.n${k}{animation:fl${k} ${s}s linear ${lap(s)}s infinite}@keyframes fl${k}{to{transform:translateX(-${TILE[k]}px)}}` }).join('')}
.zr{fill:none;stroke:#eef4f7;stroke-width:1.3}${HERD.fish.map(({ t, j }, i) => `.z${i}{opacity:0;animation:z${i} ${t}s ease-out ${short(+lap(t) - R(j * t))}s infinite}@keyframes z${i}{0%{opacity:0;transform:translateX(0px) scale(.3)}${pc((0.4 / t) * 100, 2)}{opacity:.6;transform:translateX(${num(-0.4 * SURFACE)}px) scale(.55)}${pc((5.5 / t) * 100, 2)},100%{opacity:0;transform:translateX(${num(-5.5 * SURFACE)}px) scale(2.7)}}`).join('')}
.fy{animation:fly var(--t) ease-in-out var(--j) infinite var(--r,normal)}@keyframes fly{0%,100%{opacity:.12}20%{transform:translate(7px,-5px);opacity:.9}45%{transform:translate(13px,1px);opacity:.3}70%{transform:translate(6px,6px);opacity:.8}}
.h0{animation:glint ${GLINT[0]}s ease-in-out infinite alternate}.h1{animation:glint ${GLINT[1]}s ease-in-out -1.4s infinite alternate}@keyframes glint{from{opacity:.3}to{opacity:1}}
${BANDS.map(k => `.u${k}`).join(',')},.j0,.j1{transform-origin:800px ${SHORE}px}.t1,.t2,.t3,.t4,.c1,.c2,.c3{stroke-width:${DAB_W}}${MIDS.map((m, i) => `.${RIDGE_W[i]} path{stroke-width:${m.w}px}`).join('')}.rc path{stroke-width:7px}
${BANDS.map(k => `.u${k}`).join(',')}{animation:gust ${GUST}s ease-in-out var(--d) infinite}${BANDS.map(k => `.u${k}{--d:${short(gustDelay(bandX(k)))}s}`).join('')}.vl{opacity:.85;animation:flash ${GUST}s ease-in-out var(--d) infinite}
${gustFrames('gust', s => `transform:skewX(${num(0.15 + 0.95 * s)}deg)`)}
${gustFrames('flash', s => `opacity:${num(0.8 + 0.2 * s)}`)}
.j0{animation:rustleA ${RUSTLE[0]}s ease-in-out infinite alternate}.j1{animation:rustleB ${RUSTLE[1]}s ease-in-out -1.7s infinite alternate}
@keyframes rustleA{from{transform:translate(-.3px,.1px)}to{transform:translate(.3px,-.1px)}}@keyframes rustleB{from{transform:translate(.25px,-.1px)}to{transform:translate(-.25px,.1px)}}
${variant === 'test' ? '' : [flight('fk', 31, 4, [outY(130), outY(330)], speedOf(FLOCK_SIZE), [40, 120], R(200 * ZK)), ...GULLS.map((_, i) => flight(`gf${i}`, 41 + i, 5, [outY(40), outY(300)], speedOf(GULL_SIZE), [10, 50], R(120 * ZK)))]
  .map(({ css: frames, seconds }, i) => `${frames}.${i === 0 ? 'fk' : `gf${i - 1}`}{translate:-999px;scale:1;animation:${i === 0 ? 'fk' : `gf${i - 1}`} ${seconds}s linear ${lap(seconds)}s infinite}`)
  .join('')}
${variant === 'test' ? '' : `.gy{animation:gy var(--b) ease-in-out var(--o,0s) infinite}@keyframes gy{0%,100%{transform:none}29%{transform:translateY(-.9px) rotate(-1deg)}71%{transform:translateY(.7px) rotate(1deg)}}`}
.bj{--b:${short(FLOCK_BEAT)}s;animation:jostle var(--t) ease-in-out var(--j) infinite alternate}@keyframes jostle{from{translate:-3px 1.6px}to{translate:3px -2.4px}}
@keyframes gn{0%,30%,62%,100%{rotate:0deg}42%,50%{rotate:-5deg}}.kf{fill:#5d6b7a;transform:matrix(-.6,.16,0,.75,5,-2)}
.oy{--b:${short(BEAT_S)}s;animation:oy var(--t) ease-in-out var(--j) infinite alternate,gn 23s ease-in-out var(--d) infinite}@keyframes oy{from{translate:0 -11px}to{translate:0 11px}}
marker{overflow:visible}.e2{stroke-width:${num(2.2 * PS)}}.e4{stroke-width:${num(1.6 * PS)}}${PLUMES.map((_, q) => `.k${q}{marker:url(#rp${q})}`).join('')}${REEDS.map((_, i) => `.x${i}`).join(',')}{animation:reed ${GUST}s ease-in-out var(--j) infinite}${REEDS.map(([x, y], i) => `.x${i}{transform-origin:${x}px ${y}px;--j:${short(gustDelay(x))}s}`).join('')}
${gustFrames('reed', s => `transform:skewX(${num(0.5 + 1.9 * s)}deg)`)}

.sk{animation:flake 400s linear infinite}@keyframes flake{to{transform:translateY(${Y1 - Y0}px)}}
.lg stop{stop-color:#10203f}.lg .la{stop-color:#ffe0a8}.hs{transform-origin:0 ${SHORE}px}.cu{stroke:#f2a08e}.gk{stroke:#ff9a4c}.cp{stroke:#ffb894;fill:#f6b9a4}
${variant === 'test' ? '.tm{animation:tm 12s linear infinite}@keyframes tm{to{transform:translateX(1600px)}}' : ''}
.bt{translate:${SPOTS[0][0]}px ${LANES[0]}px;animation:voyage ${VOYAGE}s linear ${lap(VOYAGE)}s infinite}
${voyage()}
.bx{scale:.56;animation:eddy 17s ease-in-out infinite,lane ${VOYAGE}s step-end ${lap(VOYAGE)}s infinite}@keyframes eddy{35%{transform:translate(14px,3px)}70%{transform:translate(-10px,-2px)}}
${boatOnSwell()}
.rw{transform-origin:-12px -1px;animation:breathe 6s ease-in-out infinite alternate}@keyframes breathe{from{scale:1}to{scale:1.02 1.04}}
.hd{transform-origin:-6px -19px;animation:hd 31s ease-in-out infinite}@keyframes hd{0%,58%,100%{rotate:0deg}66%,84%{rotate:7deg}}
.pt,.pa,.pf,.pr,.pu,.pv,.pl,.pk,.pe,.pb,.ps,.pq,.fh,.wk,.py,.pz{animation:var(--n) ${LEG}s ease-in-out ${lap(LEG)}s infinite}${['pt', 'pa', 'pf', 'pr', 'pu', 'pv', 'pl', 'pk', 'pe', 'pb', 'ps', 'pq', 'fh', 'wk', 'py', 'pz'].map(k => `.${k}{--n:${k}}`).join('')}.fh,.pq,.py{opacity:0}.pw{animation:pw 2.6s ease-in-out infinite}@keyframes pw{0%,100%{rotate:-10deg}55%{rotate:20deg}}
.r1,.r2{opacity:0;transform-box:fill-box;transform-origin:center;stroke:#eef4f7;stroke-width:1.4;fill:none}
.r1{animation:ring1 ${LEG}s ease-out ${lap(LEG)}s infinite}
.r2{animation:ring2 7s ease-out infinite}@keyframes ring2{0%{opacity:.5;transform:scale(.72)}60%,100%{opacity:0;transform:scale(2.2)}}
.fw{animation:wig .45s ease-in-out infinite alternate}@keyframes wig{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
${fishing()}
${day.css}
@media (prefers-color-scheme:dark){.nq{opacity:.7}.r1,.r2,.zr{stroke:#9fb0d6}.ln{stroke:#b9c4dc}}
.bq{display:none}@media (prefers-reduced-motion:reduce){.bm{display:none}.bq{display:inline}.cd,.ce,.md,.f0,.f1,.n0,.n1,.h0,.h1,.wr,[class^=u],.vl,.j0,.j1,.sk,.fk,.bj,.gy,.oy,[class^=gf],[class^=x],.bt,.bx,.bb,.by,.rw,.hd,[class^=p],.ln,.wk,.r1,.r2,.fh,.fw,.fb,[class^=z],.fy{animation:none}}`

  css = css.replace(/\n/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X0} ${Y0} ${X1 - X0} ${Y1 - Y0}" preserveAspectRatio="xMidYMid slice"><style>${css}</style>${geometry.replace(MOON, day.moon)}</svg>`
}
