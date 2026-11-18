# Stipple Seasons · 点彩四季

[简体中文](README.md) · [English](README.en.md) · **Español** · [日本語](README.ja.md) · [Français](README.fr.md)

Un tema (mod) para la aplicación de escritorio de Claude Code: un lago puntillista que no deja de moverse detrás del chat. Pasan las estaciones, el cielo se despeja, se nubla o nieva, y el sol y la luna salen y se ponen según tu hora local.

![Otoño, a mediodía](docs/autumn.jpg)

| | |
|---|---|
| ![Primavera, por la mañana](docs/spring.jpg)<br>Primavera, por la mañana | ![Verano, a mediodía](docs/summer.jpg)<br>Verano, a mediodía |
| ![Invierno, nevando](docs/winter.jpg)<br>Invierno, nevando | ![Amanecer](docs/dawn.jpg)<br>Amanecer |
| ![Atardecer](docs/dusk.jpg)<br>Atardecer | ![Noche de verano: luz de luna y luciérnagas](docs/night.jpg)<br>Noche de verano: luz de luna y luciérnagas |

Toda la imagen es un único SVG generado por código (unos 120 000 caracteres), sin ningún archivo de imagen. Las capturas solo lo muestran en distintos momentos.

## Qué hay en la imagen

- **Bosques y su reflejo**: laderas arboladas pintadas con pequeñas pinceladas en ambas orillas, capas de colinas azul pálido al fondo, y todo reflejado en el lago.
- **Viento**: las ráfagas cruzan de derecha a izquierda. Las copas se inclinan un poco, las hojas muestran su cara clara, los juncos se mecen y las nubes van en la misma dirección.
- **Una barca**: una barquita rema hasta un lugar de pesca y se detiene. El pescador espera sentado y de vez en cuando saca un pez. De noche lleva un farol en la proa.
- **Estaciones**: un año dura 60 minutos por defecto. Verde tierno en primavera, verde intenso y nenúfares en verano, oro y rojo en otoño, nieve en el bosque y hielo fino en el agua en invierno.
- **Tiempo**: despejado, nublado y nieve llegan con las estaciones, o se pueden fijar.
- **Día y noche**: el sol y la luna siguen el reloj local (calculado para 31° N) y la luz cambia entre el amanecer, el mediodía, el atardecer y la noche. La luna tiene una fase distinta cada día.
- **Animales**: de día cruzan el cielo gaviotas y una bandada de aves, a veces salta un pez y deja un anillo en el agua, y en las noches de verano hay luciérnagas en la orilla.

## Instalación

Necesitas la aplicación de escritorio de Claude Code. En cualquier sesión, ejecuta:

```
/plugin install stipple-seasons --marketplace Crazybrain555/stipple-seasons
```

El fondo aparece solo al instalarlo. Usa `/lake` para ver su estado y cambiarlo.

## Comandos

| Comando | Qué hace |
|---|---|
| `/lake` | Muestra el estado actual, la salida y la puesta del sol de hoy y la fase de la luna |
| `/lake auto` | Las estaciones y el tiempo cambian solos |
| `/lake spring` `summer` `autumn` `winter` | Fija una estación |
| `/lake clear` `cloudy` `snow` | Fija el tiempo; `/lake weather` vuelve a seguir las estaciones |
| `/lake year <minutos>` | Cuánto dura un año, de 4 a 1440 minutos, 60 por defecto |
| `/lake full` `lite` `test` | La imagen completa, una más ligera, una de diagnóstico |
| `/lake off` `on` | Apagar o encender |

## Si la imagen se queda quieta

Mientras reproduce un fondo, la aplicación mide cada fotograma y detiene el movimiento para siempre cuando la media supera unos 5,56 ms; queda una imagen fija: se mueve uno o dos segundos y se congela. Es más probable con el ordenador ocupado o en modo de ahorro de energía. Prueba primero `/lake lite`. `/lake test` muestra solo cielo, lago y barca, para comprobar que la aplicación puede reproducir movimiento.

## Código

| | |
|---|---|
| `hooks/scene.ts` | El generador de la escena: pinceladas, árboles, nubes, ondas, barca y aves, y cuatro «motores» compartidos para el viento, la luz, el agua y los animales |
| `hooks/day.ts` | La posición del sol y la luna |
| `hooks/register.tsx` | Los colores del tema, el comando `/lake` y el enganche del fondo |
| `hooks/make-colors.js` | La utilidad de colores del plugin theme-examples de Anthropic, pensada para copiarse en los mods; sin cambios |
| `tests/lake.test.tsx` | Pruebas que se ejecutan con `claude plugin test .`, incluidos los límites de la aplicación para un SVG de fondo |

Pintura y código de Claude. La dirección, y lo que se quedó en cada versión, lo decidió el autor después de verlo en la aplicación.
