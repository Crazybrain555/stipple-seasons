# 点彩四季 · Stipple Seasons

Claude Code 桌面应用的一个主题 mod：聊天窗口背后是一幅会动的点彩湖景。
A theme mod for the Claude Code desktop app: an animated stipple (pointillist) lake behind the chat.

![秋 autumn](docs/autumn.jpg)
![夏 summer](docs/summer.jpg)

## 画面里有什么

- 林木山坡倒映在湖里，风从右向左吹过树林，叶片翻出浅色的一面。
- 一叶小舟划到钓点停下垂钓，偶尔钓上鱼。
- 四季轮转（默认一年 60 分钟），阴、晴、雪随季节来去。
- 太阳和月亮按本地时钟升落，晨昏昼夜的光色随之变化；月相每天不同。
- 白天有海鸥和成群的飞鸟横穿天空，夏夜岸边有萤火虫。

整幅画是一个由代码生成的 SVG（约 12 万字符），没有图片素材。

## 安装

```
/plugin install stipple-seasons --marketplace Crazybrain555/stipple-seasons
```

## 用法

| 命令 | 作用 |
|---|---|
| `/lake` | 显示当前状态、日出日落和今天的月亮 |
| `/lake auto` | 四季和阴晴都轮转 |
| `/lake 春` `夏` `秋` `冬` | 定格一个季节 |
| `/lake 晴` `阴` `雪` | 定住天气；`/lake 天气` 恢复随季节 |
| `/lake year <分钟>` | 一年多长（4–1440，默认 60） |
| `/lake full` `lite` `test` | 完整版、精简版、诊断画面 |
| `/lake off` `on` | 关闭、打开 |

## 画面不动时

桌面应用播放背景时，每一帧都会给画面计时，平均超过约 5.56 毫秒就会停掉动画，只留一张静态图（表现为"动一两秒就定住"）。电脑负载高或开了省电模式时更容易出现。可以先试 `/lake lite`；`/lake test` 是只有天空、湖和小船的诊断画面，用来确认应用本身能播放动画。

## 代码

- `hooks/scene.ts`：场景生成器。色点、树、云、水纹、小舟、飞鸟，以及风、光影、水波、动物四个共用的"引擎"。
- `hooks/day.ts`：太阳和月亮的位置（北纬 31°）。
- `hooks/register.tsx`：主题配色、`/lake` 命令和背景的挂接。
- `hooks/make-colors.js`：Anthropic 官方 theme-examples 插件里供 mod 复制使用的配色工具，原样未改。
- `tests/lake.test.tsx`：`claude plugin test .` 运行的测试，其中包括桌面应用对背景 SVG 的限制（允许的 CSS 函数、不重复的 id、长度上限）。

作画和代码由 Claude 完成，方向和每一版的取舍由作者在应用里看过后决定。
