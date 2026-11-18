# Stipple Seasons · 点彩四季

[简体中文](README.md) · [English](README.en.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · **Deutsch** · [Русский](README.ru.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Ein Theme (Mod) für die Desktop-App von Claude Code: Hinter dem Chat liegt ein pointillistisch gemalter See, der sich ständig bewegt. Die Jahreszeiten wechseln, der Himmel ist klar, bewölkt oder es schneit, und Sonne und Mond gehen nach deiner Ortszeit auf und unter.

![Herbst, mittags](docs/autumn.jpg)

| | |
|---|---|
| ![Frühling, vormittags](docs/spring.jpg)<br>Frühling, vormittags | ![Sommer, mittags](docs/summer.jpg)<br>Sommer, mittags |
| ![Winter, bei Schnee](docs/winter.jpg)<br>Winter, bei Schnee | ![Morgendämmerung](docs/dawn.jpg)<br>Morgendämmerung |
| ![Abenddämmerung](docs/dusk.jpg)<br>Abenddämmerung | ![Sommernacht: Mondlicht und Glühwürmchen](docs/night.jpg)<br>Sommernacht: Mondlicht und Glühwürmchen |

Das ganze Bild ist ein einziges, per Code erzeugtes SVG (etwa 120 000 Zeichen) ohne Bilddateien. Die Screenshots zeigen es nur zu verschiedenen Zeitpunkten.

## Was im Bild zu sehen ist

- **Wälder und ihr Spiegelbild**: bewaldete Hänge an beiden Ufern, in kleinen Tupfen gemalt, dahinter blassblaue Hügel in mehreren Ebenen, und alles spiegelt sich im See.
- **Wind**: Böen ziehen von rechts nach links. Die Wipfel neigen sich leicht, die Blätter zeigen ihre helle Seite, das Schilf wiegt sich, und die Wolken treiben in dieselbe Richtung.
- **Ein Boot**: Ein kleines Boot paddelt zu einer Angelstelle und hält an. Der Angler sitzt und wartet und zieht ab und zu einen Fisch heraus. Nachts hängt eine Laterne am Bug.
- **Jahreszeiten**: Ein Jahr dauert standardmäßig 60 Minuten. Zartes Grün im Frühling, sattes Grün und Seerosen im Sommer, Gold und Rot im Herbst, Schnee auf den Wäldern und dünnes Eis auf dem Wasser im Winter.
- **Wetter**: Klar, bewölkt und Schnee kommen mit den Jahreszeiten oder lassen sich festhalten.
- **Tag und Nacht**: Sonne und Mond folgen der Ortszeit (berechnet für 31° N), und das Licht wechselt zwischen Morgendämmerung, Mittag, Abenddämmerung und Nacht. Der Mond hat jeden Tag eine andere Phase.
- **Tiere**: Tagsüber ziehen Möwen und ein Vogelschwarm über den Himmel, manchmal springt ein Fisch und hinterlässt einen Ring, und in Sommernächten leuchten Glühwürmchen am Ufer.

## Installation

Du brauchst die Desktop-App von Claude Code. Führe in einer beliebigen Sitzung aus:

```
/plugin install stipple-seasons --marketplace Crazybrain555/stipple-seasons
```

Nach der Installation erscheint der Hintergrund von selbst. Mit `/lake` siehst du den Zustand und kannst ihn ändern.

## Befehle

| Befehl | Wirkung |
|---|---|
| `/lake` | Zeigt den aktuellen Zustand, Sonnenauf- und -untergang von heute und die Mondphase |
| `/lake auto` | Jahreszeiten und Wetter wechseln von selbst |
| `/lake spring` `summer` `autumn` `winter` | Hält eine Jahreszeit fest |
| `/lake clear` `cloudy` `snow` | Hält das Wetter fest; `/lake weather` lässt es wieder den Jahreszeiten folgen |
| `/lake year <Minuten>` | Wie lange ein Jahr dauert, 4 bis 1440 Minuten, Standard 60 |
| `/lake full` `lite` `test` | Das volle Bild, ein leichteres, ein Diagnosebild |
| `/lake off` `on` | Aus- oder einschalten |

## Wenn das Bild stillsteht

Während die Desktop-App einen Hintergrund abspielt, misst sie jedes Einzelbild und hält die Bewegung endgültig an, sobald der Durchschnitt über etwa 5,56 ms liegt. Übrig bleibt ein Standbild: Es bewegt sich ein bis zwei Sekunden und friert dann ein. Das passiert eher, wenn der Rechner ausgelastet ist oder im Energiesparmodus läuft. Versuche zuerst `/lake lite`. `/lake test` zeigt nur Himmel, See und Boot, um zu prüfen, ob die App überhaupt Bewegung abspielen kann.

## Code

| | |
|---|---|
| `hooks/scene.ts` | Der Szenengenerator: Tupfen, Bäume, Wolken, Wellen, Boot und Vögel sowie vier gemeinsame „Engines“ für Wind, Licht, Wasser und Tiere |
| `hooks/day.ts` | Der Stand von Sonne und Mond |
| `hooks/register.tsx` | Die Farben des Themes, der Befehl `/lake` und die Anbindung des Hintergrunds |
| `hooks/make-colors.js` | Das Farbwerkzeug aus Anthropics Plugin theme-examples, das zum Kopieren in Mods gedacht ist; unverändert |
| `tests/lake.test.tsx` | Tests, die mit `claude plugin test .` laufen, einschließlich der Grenzen der App für ein Hintergrund-SVG |

Malerei und Code stammen von Claude. Die Richtung und was in jeder Version blieb, hat der Autor entschieden, nachdem er es in der App gesehen hatte.
