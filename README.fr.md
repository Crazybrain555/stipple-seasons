# Stipple Seasons · 点彩四季

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · **Français** · [Deutsch](README.de.md) · [Русский](README.ru.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Un thème (mod) pour l’application de bureau Claude Code : un lac pointilliste qui ne cesse de bouger derrière la conversation. Les saisons passent, le ciel se dégage, se couvre ou il neige, et le soleil et la lune se lèvent et se couchent à votre heure locale.

![Automne, à midi](docs/autumn.jpg)

| | |
|---|---|
| ![Printemps, le matin](docs/spring.jpg)<br>Printemps, le matin | ![Été, à midi](docs/summer.jpg)<br>Été, à midi |
| ![Hiver, sous la neige](docs/winter.jpg)<br>Hiver, sous la neige | ![Aube](docs/dawn.jpg)<br>Aube |
| ![Crépuscule](docs/dusk.jpg)<br>Crépuscule | ![Nuit d’été : clair de lune et lucioles](docs/night.jpg)<br>Nuit d’été : clair de lune et lucioles |

Toute l’image est un seul SVG généré par du code (environ 120 000 caractères), sans aucun fichier image. Les captures le montrent simplement à différents moments.

## Ce qu’il y a dans l’image

- **Les bois et leur reflet** : des pentes boisées peintes par petites touches sur les deux rives, des collines bleu pâle en plusieurs plans derrière, le tout reflété dans le lac.
- **Le vent** : les rafales passent de droite à gauche. Les cimes penchent un peu, les feuilles montrent leur face claire, les roseaux se balancent et les nuages vont dans le même sens.
- **Une barque** : une petite barque rame jusqu’à un coin de pêche et s’arrête. Le pêcheur attend assis et, de temps en temps, sort un poisson. La nuit, une lanterne est accrochée à la proue.
- **Les saisons** : une année dure 60 minutes par défaut. Vert tendre au printemps, vert profond et nénuphars en été, or et rouge en automne, neige sur les bois et fine glace sur l’eau en hiver.
- **Le temps** : ciel dégagé, couvert ou neige viennent avec les saisons, ou peuvent être fixés.
- **Le jour et la nuit** : le soleil et la lune suivent l’heure locale (calculée pour 31° N) et la lumière change entre l’aube, midi, le crépuscule et la nuit. La lune a une phase différente chaque jour.
- **Les animaux** : le jour, des goélands et un vol d’oiseaux traversent le ciel, un poisson saute parfois en laissant un rond dans l’eau, et les nuits d’été il y a des lucioles près de la rive.

## Installation

Il faut l’application de bureau Claude Code. Dans n’importe quelle session, lancez :

```
/plugin install stipple-seasons --marketplace Crazybrain555/stipple-seasons
```

Le fond apparaît tout seul une fois installé. Utilisez `/lake` pour voir son état et le modifier.

## Commandes

| Commande | Effet |
|---|---|
| `/lake` | Affiche l’état actuel, le lever et le coucher du soleil du jour et la phase de la lune |
| `/lake auto` | Les saisons et le temps changent tout seuls |
| `/lake spring` `summer` `autumn` `winter` | Fixe une saison |
| `/lake clear` `cloudy` `snow` | Fixe le temps ; `/lake weather` le laisse de nouveau suivre les saisons |
| `/lake year <minutes>` | Durée d’une année, de 4 à 1440 minutes, 60 par défaut |
| `/lake full` `lite` `test` | L’image complète, une version allégée, une image de diagnostic |
| `/lake off` `on` | Éteindre ou rallumer |

## Si l’image reste immobile

Pendant qu’elle joue un fond, l’application mesure chaque image et arrête définitivement le mouvement quand la moyenne dépasse environ 5,56 ms ; il reste une image fixe : elle bouge une ou deux secondes puis se fige. C’est plus probable quand l’ordinateur est chargé ou en mode économie d’énergie. Essayez d’abord `/lake lite`. `/lake test` ne montre que le ciel, le lac et la barque, pour vérifier que l’application peut jouer un mouvement.

## Code

| | |
|---|---|
| `hooks/scene.ts` | Le générateur de la scène : touches, arbres, nuages, rides, barque et oiseaux, et quatre « moteurs » partagés pour le vent, la lumière, l’eau et les animaux |
| `hooks/day.ts` | La position du soleil et de la lune |
| `hooks/register.tsx` | Les couleurs du thème, la commande `/lake` et le branchement du fond |
| `hooks/make-colors.js` | L’outil de couleurs du plugin theme-examples d’Anthropic, prévu pour être copié dans les mods ; inchangé |
| `tests/lake.test.tsx` | Les tests lancés avec `claude plugin test .`, y compris les limites de l’application pour un SVG de fond |

Peinture et code par Claude. La direction, et ce qui est resté dans chaque version, a été décidé par l’auteur après l’avoir vu dans l’application.
