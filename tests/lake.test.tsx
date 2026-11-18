import { expect, test } from 'claude-code/testing'

const SCENE = 'lake42-auto-60-full'

function engine(on: any, sets: unknown[]) {
  on('command.register', (_: unknown, e: { name: string }) => ({ value: { command: e.name } }))
  on('theme.set', (_: unknown, e: unknown) => {
    sets.push(e)
    return { value: { isDrawn: true, requestId: 'r1' } }
  })
  on('theme.clear', () => ({ value: { isDrawn: false, reason: 'cleared' } }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  const store = new Map<string, unknown>()
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store.get(e.key) }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.toast', (_: unknown, e: unknown) => {
    throw new Error(`unexpected toast: ${JSON.stringify(e)}`)
  })
  on('ui.status', () => ({ value: undefined }))
}

test('the session starts with the lake as its backdrop', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(sets.length).toBe(1)
  expect(sets[0].backdrop.scene).toBe(SCENE)
  expect(typeof sets[0].colors).toBe('object')
})

test('/lake pins a season, /lake off clears, /lake on sets it again', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const autumn = await $.command.run({ command: 'lake', args: '秋' })
  expect(String(autumn.text)).toContain('定格在秋')
  expect(sets.at(-1).backdrop.scene).toBe('lake42-autumn-60-full')

  const off = await $.command.run({ command: 'lake', args: 'off' })
  expect(String(off.text)).toContain('已关闭')

  const on2 = await $.command.run({ command: 'lake', args: 'on' })
  expect(String(on2.text)).toContain('定格在秋')

  const auto = await $.command.run({ command: 'lake', args: 'auto' })
  expect(String(auto.text)).toContain('四季轮转')
  expect(sets.at(-1).backdrop.scene).toBe(SCENE)
})

test('the backdrop draws one SVG under the size limit, on desktop and mobile', async $ => {
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'stipple-seasons',
      surface,
      component: 'Backdrop',
      props: { scene: SCENE, plugin: 'stipple-seasons', glass: { blur: 14, opacity: 0.55 } },
    } as any)
    const svg = await ui.find({ type: 'Svg' })
    const source = String(svg?.props.source ?? '')
    expect(source.startsWith('<svg')).toBe(true)
    expect(source.length < 131072).toBe(true)
    expect(source.includes('viewBox="-496 -632 2592 2016"')).toBe(true)
    await ui.unmount()
  }
})

test('/lake test and /lake lite draw lighter scenes', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const v of ['test', 'lite'] as const) {
    await $.command.run({ command: 'lake', args: v })
    const scene = sets.at(-1).backdrop.scene
    expect(scene).toBe(`lake42-auto-60-${v}`)
    const ui = await $.ui.mount({ plugin: 'stipple-seasons', surface: 'desktop', component: 'Backdrop', props: { scene, plugin: 'stipple-seasons', glass: { blur: 14, opacity: 0.55 } } } as any)
    const source = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
    expect(source.length < (v === 'test' ? 30000 : 125000)).toBe(true)
    await ui.unmount()
  }
})

// The desktop app shows a still frame for a scene that calls a CSS function outside its list (path() was one).
const ALLOWED = new Set('color color-mix hsl hsla hwb lab lch light-dark oklab oklch rgb rgba abs acos asin atan atan2 calc clamp cos exp hypot log max min mod pow rem round sign sin sqrt tan var matrix matrix3d perspective rotate rotate3d rotatex rotatey rotatez scale scale3d scalex scaley scalez skew skewx skewy translate translate3d translatex translatey translatez cubic-bezier linear steps blur drop-shadow grayscale hue-rotate invert opacity saturate sepia is not nth-child nth-last-child nth-last-of-type nth-of-type where url'.split(' '))

test('every scene uses only what the desktop app lets move', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const v of ['full', 'lite', 'test'] as const) {
    await $.command.run({ command: 'lake', args: v })
    const scene = sets.at(-1).backdrop.scene
    const ui = await $.ui.mount({ plugin: 'stipple-seasons', surface: 'desktop', component: 'Backdrop', props: { scene, plugin: 'stipple-seasons', glass: { blur: 14, opacity: 0.55 } } } as any)
    const source = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
    const style = (source.match(/<style>([^<]*)<\/style>/) ?? ['', ''])[1]
    const calls = [...style.matchAll(/([A-Za-z-]+)\(/g)].map(m => m[1].toLowerCase()).filter(n => !ALLOWED.has(n))
    expect(calls).toEqual([])
    expect(/\d[sld]?v(w|h|i|b|min|max)\b|shape-rendering|vector-effect|\\/.test(source)).toBe(false)
    expect(/@media(?![^{]*prefers-)/.test(style)).toBe(false)
    await ui.unmount()
  }
})

test('/lake 晴|阴|雪 holds the weather, /lake auto lets it turn again', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const snow = await $.command.run({ command: 'lake', args: '雪' })
  expect(String(snow.text)).toContain('一直下雪')
  const scene = sets.at(-1).backdrop.scene
  expect(scene).toBe('lake42-auto-60-full-snow')
  const ui = await $.ui.mount({ plugin: 'stipple-seasons', surface: 'desktop', component: 'Backdrop', props: { scene, plugin: 'stipple-seasons', glass: { blur: 14, opacity: 0.55 } } } as any)
  const source = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
  expect(source.includes('.sn{opacity:1}')).toBe(true)
  expect(source.length < 131072).toBe(true)
  await ui.unmount()

  await $.command.run({ command: 'lake', args: '阴' })
  expect(sets.at(-1).backdrop.scene).toBe('lake42-auto-60-full-cloudy')

  await $.command.run({ command: 'lake', args: 'auto' })
  expect(sets.at(-1).backdrop.scene).toBe('lake42-auto-60-full')
})

test('the sun and moon keep the local clock, and /lake says when they rise and set', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'stipple-seasons', surface: 'desktop', component: 'Backdrop', props: { scene: SCENE, plugin: 'stipple-seasons', glass: { blur: 14, opacity: 0.55 } } } as any)
  const source = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
  for (const part of ['@keyframes sx{', '@keyframes mx{', '@keyframes nk{', '86400s linear', 'class="mx"', 'fill="#f3eed8"', 'clip-path="url(#sk)"']) {
    expect(source.includes(part)).toBe(true)
  }
  expect(source.includes('<g id="moon"/>')).toBe(false)
  await ui.unmount()

  const said = String((await $.command.run({ command: 'lake', args: '' })).text)
  expect(/此刻 \d\d:\d\d · 日出 \d\d:\d\d 日落 \d\d:\d\d/.test(said)).toBe(true)
})

// Two templates with one id: every <use> of it draws the first (v27 drew gulls where groves of trees should stand).
test('no id occurs twice in any scene, and every href names one', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const args of ['full', 'lite', 'test', '雪', '冬'] as const) {
    await $.command.run({ command: 'lake', args })
    const scene = sets.at(-1).backdrop.scene
    const ui = await $.ui.mount({ plugin: 'stipple-seasons', surface: 'desktop', component: 'Backdrop', props: { scene, plugin: 'stipple-seasons', glass: { blur: 14, opacity: 0.55 } } } as any)
    const source = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
    const ids = [...source.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
    expect(ids.length > 0).toBe(true)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    const refs = [...source.matchAll(/href="#([^"]+)"/g)].map(m => m[1])
    expect(refs.filter(r => !ids.includes(r))).toEqual([])
    await ui.unmount()
  }
})
