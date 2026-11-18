import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { crossing, dayAt, phaseName } from './day'
import { lakeScene, SEASONS, WEATHERS } from './scene'
import type { Season, Weather } from './scene'

const PLUGIN = 'stipple-seasons'
const COMMAND = 'lake'
const DEFAULT_MINUTES = 60
// Part of the scene's name: a new value makes the app draw the scene again instead of keeping the one it has.
const SCENE_VERSION = 42

// The app's own colours, tinted to the lake: misty blue paper by day, moonlit navy by night.
const { theme, problems } = makeColors({
  label: 'Stipple Seasons',
  roles: { accent: '#2f63a8', danger: '#b3393a', success: '#3f7d4a', warning: '#9a6414', pro: '#6a54b0' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#dfe6ee',
        'surface-1': '#e8eef4',
        'surface-2': '#f2f5f9',
        'text-primary': '#16233a',
        'text-secondary': '#33435e',
        'text-muted': '#4c5b75',
      },
    },
  },
  dark: {
    roles: { accent: '#8fb0ff', danger: '#ec7a80', success: '#7cc493', warning: '#e2aa50', pro: '#b4a2f2' },
    gray: {
      anchors: {
        'surface-0': '#0e1530',
        'surface-1': '#141c3a',
        'surface-2': '#1a2344',
        'surface-3': '#1f294c',
        'text-primary': '#eef1f8',
        'text-secondary': '#c3cbe0',
        'text-muted': '#99a4c2',
      },
    },
  },
})
const UNPAINTED = problems.find(line => line.startsWith("Desktop won't paint"))

type Mode = 'auto' | Season
const MODE_WORDS: Record<string, Mode> = {
  auto: 'auto', 自动: 'auto', 轮转: 'auto',
  spring: 'spring', 春: 'spring', 春天: 'spring',
  summer: 'summer', 夏: 'summer', 夏天: 'summer',
  autumn: 'autumn', fall: 'autumn', 秋: 'autumn', 秋天: 'autumn',
  winter: 'winter', 冬: 'winter', 冬天: 'winter',
}
const MODE_NAMES: Record<Mode, string> = { auto: '四季轮转', spring: '春', summer: '夏', autumn: '秋', winter: '冬' }

// Weather: 'auto' lets it come and go with the year; the others hold it.
type Sky = 'auto' | Weather
const SKY_WORDS: Record<string, Sky> = {
  cloudy: 'cloudy', 阴: 'cloudy', 阴天: 'cloudy', 多云: 'cloudy',
  snow: 'snow', 雪: 'snow', 下雪: 'snow', 雪天: 'snow',
  clear: 'clear', sunny: 'clear', 晴: 'clear', 晴天: 'clear',
  weather: 'auto', 天气: 'auto', 阴晴: 'auto', 天气轮转: 'auto',
}
const SKY_NAMES: Record<Sky, string> = { auto: '阴晴随季节', cloudy: '一直阴天', snow: '一直下雪', clear: '一直晴天' }

type Variant = 'full' | 'lite' | 'test'
type Settings = { mode: Mode; minutes: number; off: boolean; variant: Variant; sky: Sky }

async function variantOf($: EngineInterface): Promise<Variant> {
  const v = await $.store.get('variant')
  return v === 'lite' || v === 'test' ? v : 'full'
}

async function settings($: EngineInterface): Promise<Settings> {
  const mode = await $.store.get('mode')
  const minutes = Number(await $.store.get('minutes'))
  return {
    mode: typeof mode === 'string' && (mode === 'auto' || (SEASONS as readonly string[]).includes(mode)) ? (mode as Mode) : 'auto',
    minutes: Number.isFinite(minutes) && minutes >= 4 && minutes <= 1440 ? minutes : DEFAULT_MINUTES,
    off: (await $.store.get('off')) === true,
    variant: await variantOf($),
    sky: await skyOf($),
  }
}

async function skyOf($: EngineInterface): Promise<Sky> {
  const v = await $.store.get('sky')
  return typeof v === 'string' && (WEATHERS as readonly string[]).includes(v) ? (v as Weather) : 'auto'
}

const sceneName = (s: Settings) => `lake${SCENE_VERSION}-${s.mode}-${s.minutes}-${s.variant}${s.sky === 'auto' ? '' : `-${s.sky}`}`

function parseScene(name: string): { mode: Mode; minutes: number; variant: Variant; sky: Sky } | undefined {
  const m = /^lake\d*-(auto|spring|summer|autumn|winter)-(\d+)(?:-(full|lite|test))?(?:-(clear|cloudy|snow))?$/.exec(name)
  return m === null
    ? undefined
    : { mode: m[1] as Mode, minutes: Number(m[2]), variant: (m[3] ?? 'full') as Variant, sky: (m[4] ?? 'auto') as Sky }
}

async function apply($: EngineInterface): Promise<string | undefined> {
  const s = await settings($)
  if (s.off) return undefined
  const look: ThemeSetArgs = {
    colors: theme,
    backdrop: { scene: sceneName(s), glass: { blur: 14, opacity: 0.55 } },
  }
  const set = await $.theme.set(look)
  return UNPAINTED ?? (set.isDrawn || set.requestId !== undefined ? undefined : set.reason)
}

/** Today on the local clock: the time, sunrise and sunset, and the moon drawn for tonight. */
function today(): string {
  const now = Date.now() / 1000
  const day = dayAt(now, -new Date().getTimezoneOffset())
  const hm = (m: number | undefined) => (m === undefined ? '—' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return `此刻 ${hm(Math.floor(day.second / 60))} · 日出 ${hm(crossing(day.sun, true))} 日落 ${hm(crossing(day.sun, false))} · 今天的月亮：${phaseName(day.phase)}（每天随机），${hm(crossing(day.moon, true))} 升起 ${hm(crossing(day.moon, false))} 落下`
}

function describe(s: Settings): string {
  const kind = s.variant === 'test' ? '（诊断画面：只有天空、湖和小船）' : s.variant === 'lite' ? '（精简版）' : ''
  const season = s.mode === 'auto' ? `四季轮转，一年 ${s.minutes} 分钟` : `定格在${MODE_NAMES[s.mode]}`
  const state = (s.off ? '已关闭' : `${season}，${s.sky === 'auto' && s.mode !== 'auto' ? '晴天' : SKY_NAMES[s.sky]}`) + kind
  return (
    `点彩四季：${state}。\n${today()}\n` +
    `/lake auto 四季和阴晴都轮转 · /lake 春|夏|秋|冬 定格一个季节 · /lake 晴|阴|雪 定住天气 · /lake 天气 天气随季节 · /lake year <分钟> 一年多长（默认 ${DEFAULT_MINUTES}）· /lake off 关闭 · /lake on 打开 · /lake test 诊断画面 · /lake lite 精简版 · /lake full 完整版`
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND,
        description: '点彩四季湖景：auto 四季轮转，春/夏/秋/冬 定格季节，晴/阴/雪 定住天气，year <分钟> 调一年长度，off/on 关开',
      })
    } catch (error) {
      void $.ui.toast(`${PLUGIN}: /${COMMAND} 不可用 (${String(error)})`)
    }
    try {
      const fault = await apply($)
      if (fault !== undefined) $.ui.status(fault)
    } catch (error) {
      void $.ui.toast(`${PLUGIN}: ${String(error)}`)
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const words = e.args.trim().toLowerCase().split(/\s+/).filter(w => w !== '')
    const [first, second] = words

    if (first === undefined) {
      return { text: describe(await settings($)) }
    }
    if (first === 'off' || first === '关') {
      await $.store.set('off', true)
      await $.theme.clear()
      return { text: '点彩四季已关闭。/lake on 打开。' }
    }
    if (first === 'on' || first === '开') {
      await $.store.set('off', false)
      const fault = await apply($)
      return { text: fault ?? describe(await settings($)) }
    }
    if (first === 'test' || first === 'lite' || first === 'full') {
      await $.store.set('variant', first)
      await $.store.set('off', false)
      const fault = await apply($)
      return { text: fault ?? describe(await settings($)) }
    }
    if (first === 'year' || first === '年') {
      const minutes = Math.round(Number(second))
      if (!Number.isFinite(minutes) || minutes < 4 || minutes > 1440) {
        return { text: '一年的长度写分钟数，4 到 1440 之间，比如 /lake year 60。' }
      }
      await $.store.set('minutes', minutes)
      await $.store.set('off', false)
      const fault = await apply($)
      return { text: fault ?? describe(await settings($)) }
    }
    const sky = SKY_WORDS[first]
    if (sky !== undefined) {
      await $.store.set('sky', sky)
      await $.store.set('off', false)
      const fault = await apply($)
      return { text: fault ?? describe(await settings($)) }
    }
    const mode = MODE_WORDS[first]
    if (mode === undefined) {
      return { text: `不认识 "${first}"。\n${describe(await settings($))}` }
    }
    await $.store.set('mode', mode)
    if (mode === 'auto') await $.store.set('sky', 'auto')
    await $.store.set('off', false)
    const fault = await apply($)
    return { text: fault ?? describe(await settings($)) }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const parsed = parseScene(e.props.scene)
    if (parsed === undefined) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const source = lakeScene({
      now: Date.now() / 1000,
      year: parsed.minutes * 60,
      variant: parsed.variant,
      ...(parsed.mode === 'auto' ? {} : { pinned: parsed.mode }),
      ...(parsed.sky === 'auto' ? {} : { weather: parsed.sky }),
    })
    return (
      <Svg
        isInteractive
        alt="点彩湖景：林木山坡倒映在湖里，风吹过树林，一叶小舟从左往右漂过湖面，飞鸟横穿天空；日月照着本地时间升落，晨昏昼夜随之变色，四季与阴晴慢慢变化"
        source={source}
      />
    )
  })
}
