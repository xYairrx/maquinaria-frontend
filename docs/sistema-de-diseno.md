# Sistema de diseño

Derivado de la maqueta del panel general que definió el usuario. Es la referencia
visual del producto: **cuando una pantalla nueva no sepa cómo verse, se mira aquí**, no
se inventa.

> **Esto describe CÓMO se ven las cosas, no QUÉ hay que construir.**
>
> La maqueta de la que sale traía un panel lleno de indicadores, gráficas y listas. Esos
> números eran de ejemplo. Las secciones de abajo definen la forma que tendrán esos
> elementos **el día que existan y tengan de dónde sacar sus datos**; no son una lista de
> pendientes ni una invitación a maquetarlos antes.
>
> Regla, en palabras del usuario: *«no coloques información que aún no tenemos»*. Un dato
> inventado en una pantalla se ve exactamente igual que uno real, y quien la mire creerá
> que el sistema ya lo calcula.

Los colores no se escriben en hexadecimal en las plantillas. Todos están como tokens en
`src/styles.css` dentro de `@theme`, y cada `--color-X` genera sus utilidades (`bg-X`,
`text-X`, `border-X`…). El nombre del token es el nombre de la clase.

## Tipografía

Dos familias, servidas desde Google Fonts. Como los colores, **no se escriben en las
plantillas**: son tokens `--font-*` dentro del `@theme` de `src/styles.css`, y el nombre
del token es el nombre de la clase.

| Token | Valor | Utilidad | Para qué |
|---|---|---|---|
| `--font-sans` | `'Merriweather', ui-serif, Georgia, serif` | `font-sans` (y por defecto) | **Todo** el cuerpo |
| `--font-titulo` | `'Lato', ui-sans-serif, system-ui, sans-serif` | `font-titulo` | Solo títulos, uno por uno |

**La jerarquía va al revés de lo habitual**: se titula en **sans** sobre un cuerpo en
**serif**. Es deliberado. El contraste entre las dos familias sigue existiendo —que es
para lo que sirve tener dos—, solo que invertido.

**Merriweather es la fuente por defecto y no hay que pedirla.** Tailwind v4 deriva
`--default-font-family` de `--font-sans`, y su Preflight la aplica a `html`; todo lo demás
la hereda. En el tema está además escrito explícito para que la decisión se vea, en lugar
de depender de un detalle interno del framework. Escribir `font-sans` en una plantilla es
redundante.

El token se llama `sans` aunque Merriweather sea una **serif**: ese nombre es el de la
ranura que Tailwind usa para la familia por defecto, no una descripción de la fuente.
Renombrarlo a `--font-merriweather` generaría la utilidad pero dejaría la aplicación en la
fuente del sistema.

**Las dos pilas de reserva son de verdad, no adorno.** En una red que bloquee Google
Fonts, o sencillamente en el primer render antes de que la descarga termine, la aplicación
tiene que seguir legible: Merriweather cae a la serif del sistema y Lato a la sans, de modo
que el título sigue contrastando con el cuerpo en vez de fundirse con él.

### Dos cosas prácticas al maquetar

**Merriweather ocupa más ancho que una sans** al mismo tamaño —unos 8 % sobre Lato—.
Vigila las tablas y el menú lateral, donde el espacio horizontal está contado, y los
botones con texto largo.

**Los pesos no son simétricos.** Merriweather es variable de 300 a 900, así que en el
cuerpo `font-medium` (500) y `font-semibold` (600) existen de verdad. El corte de Lato, en
cambio, trae 100, 300, 400, 700 y 900 — **sin 500 ni 600**: un título con `font-semibold`
se pinta en 700. No rompe nada, pero ese escalón intermedio no existe en los títulos.

### Cuándo se usa `font-titulo`

Se aplica **a mano y una por una**, y **nunca con una regla global `h1, h2 { … }`**. Esa
regla parece la solución obvia y es justo la trampa: en este producto la mayoría de los
`<h2>` son **etiquetas de 14 px en negrita** —«Tu acceso», «Módulos», «{{ n }} empresas»,
«Dar de alta una empresa»—, y cambiarles la familia solo añade ruido. El título de una
pantalla no es lo mismo que el rótulo que abre una sección.

Hoy la llevan:

- El `<h1>` de las pantallas de acceso (`paginas/acceso/marco-acceso.html`) y, en el panel
  de marca de ese mismo archivo, el nombre del producto.
- El `<h1>` de la pantalla, cuando es el título de la página entera: la razón social en
  `empresa/inicio`, «Empresas» en `plataforma/empresas`, «Define tu contraseña» en
  `empresa/aceptar-invitacion`.

En la duda, se deja en el cuerpo: añadir la clase después cuesta una línea, y quitarla de
donde no debía estar cuesta encontrarla.

## La forma general

Tres zonas fijas:

```
┌──────────────┬──────────────────────────────────────────────┐
│              │  Barra superior  (bg-superficie)             │
│  Menú        ├──────────────────────────────────────────────┤
│  lateral     │                                              │
│  (negro,     │  Contenido  (bg-fondo-app)                   │
│  264 px)     │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

El menú ocupa el alto completo y no se desplaza con el contenido. El contenido es lo
único que hace scroll.

## Radios y espaciado

| Elemento | Radio | Clase |
|---|---|---|
| Tarjeta, panel, caja del menú | 12 px | `rounded-xl` |
| Botón, campo, opción de menú | 8 px | `rounded-lg` |
| Chip de filtro, badge cuadrado | 6 px | `rounded-md` |
| Badge de conteo | píldora | `rounded-full` |

Relleno: tarjetas `p-5`, barra superior `px-6 py-4`, contenido `p-6`, separación entre
bloques `gap-5`.

## Menú lateral

Fondo `negro-lateral`. Ancho fijo `w-66` (264 px).

**Identidad, arriba.** Cuadrado de 32 px `rounded-lg` en `bg-amarillo` con el glifo en
`sobre-amarillo`, y al lado el nombre del producto en `texto-inverso`, semibold, 15 px.
Debajo, la línea descriptiva en `texto-inverso-tenue`, 9-10 px, mayúsculas y
`tracking-wide`.

**Encabezado de grupo.** «OPERACIÓN», «ADMINISTRACIÓN». 10-11 px, mayúsculas,
`tracking-wide`, `text-texto-inverso-tenue`, `px-3 pb-2 pt-6`. Los grupos existen porque
26 módulos en una lista plana no se recorren con la vista.

**Opción del menú.** Alto 40 px, `rounded-lg`, `px-3`, `gap-3`, icono de 18 px con trazo
de 1.75, texto de 14 px.

| Estado | Fondo | Texto | Icono |
|---|---|---|---|
| Reposo | — | `texto-inverso-suave` | hereda |
| Hover | `negro-caja` | `texto-inverso` | hereda |
| **Activo** | **`amarillo`** | **`sobre-amarillo`, medium** | `sobre-amarillo` |

La opción activa es una **píldora amarilla sólida**, no un filete lateral. Lleva además
`aria-current="page"`: el color nunca es el único indicio (WCAG 1.4.1).

Foco visible: `outline-2 outline-offset-2 outline-amarillo` sobre el negro.

**Tarjeta de indicador, abajo.** Pegada al fondo con `mt-auto`. `rounded-xl`,
`bg-negro-caja`, `border border-negro-caja-borde`, `p-4`. Dentro: micro-etiqueta en
`texto-inverso-micro` (10 px, mayúsculas), la cifra grande en `texto-inverso` (28 px,
bold), una barra de progreso y un pie en `texto-inverso-tenue` (11 px).

**Barra de progreso**: pista de 4 px `rounded-full` en `negro-caja-borde`, relleno en
`amarillo`. El valor debe ir también como texto: una barra sola no es accesible.

## Barra superior

`bg-superficie`, `border-b border-borde`, `px-6 py-4`.

- **Izquierda**: título de la pantalla en `texto`, 22 px semibold. Debajo, contexto en
  `texto-apagado`, 13 px, con `·` de separador.
- **Derecha**: campo de búsqueda, acción principal y avatar.

**Campo de búsqueda**: `bg-superficie-hover`, `rounded-lg`, **sin borde**, icono de lupa
en `texto-tenue` a la izquierda, marcador de posición en `texto-apagado`, ancho ~280 px.
Es la única excepción a la regla del borde de campo, porque el fondo ya lo separa.

**Acción principal**: `bg-amarillo`, texto `sobre-amarillo` medium, `rounded-lg`,
`px-4 py-2.5`, hover `amarillo-hover`. Con `+` delante cuando crea algo.

**Avatar**: círculo de 36 px, `bg-negro-tarjeta`, iniciales en `texto-inverso`, 12 px.

## Tarjetas de indicador

`bg-superficie`, `rounded-xl`, `border border-borde`, `p-5`.

- Etiqueta: `texto-apagado`, 11 px, mayúsculas, `tracking-wide`. El icono va **arriba a
  la derecha**, 16 px, en `texto-apagado`.
- Cifra: `texto`, 30 px, bold, `tabular-nums`.
- Pie: `texto-apagado`, 12 px.

**Variante destacada** — para el indicador que hay que mirar primero, uno por pantalla:
`bg-negro-tarjeta`, etiqueta en `texto-inverso-micro`, **cifra en `amarillo`**, pie en
`texto-inverso-tenue`.

## Listas de aviso

Cada elemento: `bg-superficie`, `border border-borde`, **`border-l-4 border-l-amarillo`**,
`rounded-lg`, `px-4 py-3`. Título 14 px medium en `texto`, detalle 12 px en
`texto-apagado`, fecha a la derecha 12 px en `texto-apagado`.

**Badge de conteo**: `bg-alerta-fondo`, `text-alerta-texto`, `rounded-full`, 11 px,
`px-2 py-0.5`.

## Chips de filtro

Grupo horizontal, `gap-2`. Activo: `bg-negro-tarjeta`, `text-texto-inverso`. Inactivo:
`bg-superficie`, `border border-borde`, `text-texto-secundario`. Ambos `rounded-md`,
`px-3.5 py-1.5`, 13 px.

Van en un `<div role="group">` con etiqueta, y el activo lleva `aria-pressed="true"`.

## Tablas

Encabezado `bg-superficie-sutil`, `border-b border-borde`, texto 11 px mayúsculas en
`texto-apagado`. Filas separadas por `border-b border-borde-fila`, la última sin borde.
Celdas `px-4 py-2.5`: la primera columna en `texto` medium, el resto en
`texto-secundario`. Cifras con `tabular-nums`.

Toda tabla va envuelta en `overflow-x-auto`: el cuerpo de la página nunca hace scroll
horizontal.

## Pantallas de acceso

**Dos columnas a pantalla completa.** No llevan menú: todavía no hay sesión ni empresa
que mostrar.

```
┌───────────────────┬──────────────────────────────────┐
│                   │                                  │
│   Formulario      │   Panel de marca                 │
│   (superficie)    │   (negro-lateral)                │
│   ~38 %, min 380  │   resto                          │
│                   │                                  │
└───────────────────┴──────────────────────────────────┘
```

**Columna del formulario.** `bg-superficie`, alto completo, contenido centrado
verticalmente, ancho de contenido `max-w-sm`, `px-8`. En este orden:

1. Bloque de identidad **centrado**: el cuadrado amarillo de 32 px con el glifo, y al
   lado el nombre del producto en `texto` 18 px semibold.
2. Título de la pantalla, centrado, `texto`, 22 px semibold.
3. Una línea de apoyo centrada en `texto-apagado`, 13 px.
4. Los campos, con la etiqueta **alineada a la izquierda** en `texto-secundario`.
5. Botón principal **a lo ancho** (`w-full`).
6. Debajo del botón, centrado, el enlace secundario en `texto-secundario` con subrayado
   y 13 px.

**Columna de marca.** `bg-negro-lateral`, alto completo. Se oculta por debajo de `lg`
(`hidden lg:flex`) y entonces el formulario ocupa todo el ancho: en un teléfono, media
pantalla decorativa es media pantalla perdida.

Dentro va la identidad del producto en grande y una frase corta, nada más:
`texto-inverso` para el nombre, `texto-inverso-suave` para la frase. **Sin ilustración de
catálogo, sin fotografías de archivo y sin métricas de ejemplo.** Si algún día hay una
ilustración propia, este es su sitio.

**Campos**: `border border-borde-campo`, `bg-superficie`, `rounded-lg`, `px-3 py-2`,
etiqueta en `texto-secundario` 14 px medium, ayuda en `texto-apagado` 12 px. El borde del
campo usa `borde-campo` y **no** `borde`: un control necesita 3:1 (WCAG 1.4.11), y `borde`
es decorativo (1.29:1 contra blanco).

**Botón deshabilitado**: `bg-estado-neutro-fondo`, `text-estado-neutro-texto`.

### Lo que NO va en un acceso de este producto

La maqueta de referencia venía de otro producto y traía elementos que aquí serían
mentira:

- **«¿No tienes cuenta? Regístrate»** — no hay registro público. Los usuarios los crea un
  superadministrador por invitación con token de un solo uso.
- **Avisos legales y enlaces a términos o privacidad** — esas páginas no existen todavía.
- **«Recordarme»** — la sesión ya persiste; una casilla que no cambia nada es peor que no
  tenerla.

Lo que sí va: **«¿Olvidaste tu contraseña?»**, debajo del botón y centrado.

## Lo que no se hace

- **Nada de verde ni rojo.** La paleta es monocroma más amarillo. Un aviso positivo se
  marca con filete negro a la izquierda; uno de atención, con el par `alerta-*`.
- **Nada de `opacity` para apagar contenido.** Arrastra el texto por debajo del contraste
  mínimo. Para eso está el par `estado-neutro-fondo` / `estado-neutro-texto`.
- **`amarillo` nunca como texto sobre fondo claro ni como anillo de foco ahí**: da 1.61:1
  contra `superficie`. Solo como relleno con `sobre-amarillo` encima, como filete, o como
  cifra sobre negro.
- **`texto-tenue` nunca en texto normal**: 3.45:1. Solo texto grande o elementos no
  textuales.
