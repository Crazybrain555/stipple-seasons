// The day on the local clock: where the sun and the moon stand at each minute, and how far the sun is below or
// above the horizon, from which the scene works out the light. Pure numbers, nothing drawn here.

/** Degrees north the sky is reckoned for: about the lower Yangtze, which suits a clock on UTC+8. */
export const LAT = 31
const RAD = Math.PI / 180

/** Height above the horizon and compass bearing (degrees, 90 east, 180 south) of a body with this declination
 * at this hour angle (degrees from its highest point, negative before it). */
export function altAz(dec: number, ha: number): [number, number] {
  const p = LAT * RAD
  const d = dec * RAD
  const h = ha * RAD
  const el = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h)) / RAD
  const az = (Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(p) - Math.tan(d) * Math.cos(p)) / RAD + 540) % 360
  return [el, az]
}

export type Day = {
  /** Seconds since local midnight. */
  second: number
  /** The local date, as days since 1970-01-01. */
  number: number
  /** The sun's [height, bearing] at a minute of the local day (0 to 1440). */
  sun: (minute: number) => [number, number]
  /** The moon's [height, bearing] at a minute of the local day. */
  moon: (minute: number) => [number, number]
  /** How far the sun is through its day arc at a minute: its hour angle over its half arc, -1 at rising, 0 at its
   * highest, 1 at setting (beyond ±1 below the horizon). Steady with the clock, so a drawing can place it by this. */
  sunArc: (minute: number) => number
  /** The same for the moon. */
  moonArc: (minute: number) => number
  /** Where the moon is in its month, 0 new and 0.5 full: drawn at random for each date, never quite new. */
  phase: number
}

/** The day `now` (seconds since the epoch) falls in, on a clock `tz` minutes east of UTC. */
export function dayAt(now: number, tz: number): Day {
  const local = now + tz * 60
  const number = Math.floor(local / 86400)
  const second = local - number * 86400
  const date = new Date(number * 86400000)
  const n = (number * 86400000 - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000
  const dec = -23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10))
  const b = (2 * Math.PI * (n - 81)) / 364
  // minutes the sundial runs ahead of the clock; the clock's zone is taken to be the place's own meridian
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  const hour = (minute: number) => (minute + eot - 720) / 4
  const seed = Math.sin(number * 12.9898 + 4.1414) * 43758.5453
  const phase = 0.1 + 0.8 * (seed - Math.floor(seed))
  // the moon trails the sun by its age in the month, and rides high when full in winter, low when full in summer
  const moonDec = dec * Math.cos(2 * Math.PI * phase)
  /** Hour angle (degrees, -180 to 180) over the half arc above the horizon, for a body of this declination. */
  const arc = (d: number, ha: number) => {
    const half = Math.acos(Math.max(-1, Math.min(1, -Math.tan(LAT * RAD) * Math.tan(d * RAD)))) / RAD
    return ((((ha % 360) + 540) % 360) - 180) / half
  }
  return {
    second,
    number,
    phase,
    sun: minute => altAz(dec, hour(minute)),
    moon: minute => altAz(moonDec, hour(minute) - 360 * phase),
    sunArc: minute => arc(dec, hour(minute)),
    moonArc: minute => arc(moonDec, hour(minute) - 360 * phase),
  }
}

/** The minute of the day a body's centre crosses the horizon going up (rise) or down (set), if it does. */
export function crossing(at: (minute: number) => [number, number], rise: boolean): number | undefined {
  for (let m = 0; m < 1440; m++) {
    const a = at(m)[0] + 0.83
    const b = at(m + 1)[0] + 0.83
    if (rise ? a < 0 && b >= 0 : a >= 0 && b < 0) return m
  }
  return undefined
}

export const phaseName = (p: number) =>
  p < 0.03 || p > 0.97 ? '新月' : p < 0.22 ? '蛾眉月' : p < 0.28 ? '上弦月' : p < 0.47 ? '盈凸月' : p < 0.53 ? '满月' : p < 0.72 ? '亏凸月' : p < 0.78 ? '下弦月' : '残月'

/** A value read off a table of [x, value] rows sorted by x, straight between rows and flat beyond the ends. */
export function ramp(x: number, rows: readonly (readonly [number, number])[]): number {
  if (x <= rows[0]![0]) return rows[0]![1]
  for (let i = 1; i < rows.length; i++) {
    const [x1, v1] = rows[i]!
    if (x <= x1) {
      const [x0, v0] = rows[i - 1]!
      return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0)
    }
  }
  return rows[rows.length - 1]![1]
}
