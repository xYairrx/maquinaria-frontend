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

- El `<h1>` de las pantallas de acceso (`paginas/acceso/marco-acceso.html`) y, en la barra
  superior de ese mismo archivo, el nombre del producto en dos colores.
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

**Única desviación admitida**: el botón principal de las pantallas de acceso es una
**píldora** (`boton-acceso`). Está acotada a esas pantallas y no se extiende al resto; el
porqué está en §Pantallas de acceso.

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

Es uno de los dos sitios donde el campo no lleva borde —el otro es `campo-acceso` de las
pantallas de acceso—, y por la misma razón: la regla de `borde-campo` existe para los
controles cuyo contorno es el único indicio de que son un control, y aquí el fondo ya los
separa. **A cambio, el `outline` de foco deja de ser opcional.**

**Acción principal**: `bg-amarillo`, texto `sobre-amarillo` medium, `rounded-lg`,
`px-4 py-2.5`, hover `amarillo-hover`. Con `+` delante cuando crea algo.

**Avatar**: círculo de 36 px, `bg-negro-tarjeta`, iniciales en `texto-inverso`, 12 px.

## Tarjetas de indicador

Escritas como `@utility tarjeta-indicador` y `@utility tarjeta-indicador-destacada` en
`src/styles.css`. En uso en `paginas/plataforma/dashboard/`.

`bg-superficie`, `rounded-xl`, `border border-borde`, `p-5`.

- Etiqueta: `texto-apagado`, 11 px, mayúsculas, `tracking-wide`. El icono va **arriba a
  la derecha**, 16 px, en `texto-apagado`.
- Cifra: `texto`, 30 px, bold, `tabular-nums`.
- Pie: `texto-apagado`, 12 px.

**Variante destacada** — para el indicador que hay que mirar primero, uno por pantalla:
`bg-negro-tarjeta`, etiqueta en `texto-inverso-micro`, **cifra en `amarillo`**, pie en
`texto-inverso-tenue`.

## Listas de aviso

Escritas como `@utility aviso` en `src/styles.css`.

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

## Campos de formulario dentro de la aplicación

`border border-borde-campo`, `bg-superficie`, `rounded-lg`, `px-3 py-2`, etiqueta **a la
vista y alineada a la izquierda** en `texto-secundario` 14 px medium, ayuda en
`texto-apagado` 12 px.

El borde usa `borde-campo` y **no** `borde`: un control necesita 3:1 (WCAG 1.4.11), y
`borde` es decorativo (1.29:1 contra blanco). `borde-campo` llega a 3.45:1 sobre
`superficie`.

Los campos rellenos y sin borde son la **excepción**, no la norma: el buscador de la barra
superior y `campo-acceso` de las pantallas de acceso. Un formulario de alta de datos —dar
de alta una empresa, editar un equipo— lleva borde y etiqueta visible.

## Pantallas de acceso

**Dos columnas a pantalla completa.** No llevan menú: todavía no hay sesión ni empresa
que mostrar.

```
┌───────────────────┬──────────────────────────────────┐
│ RETRO·MAQ    ES ▾ │                                  │
│                   │   Panel de marca                 │
│    Formulario     │   (negro-lateral + fotografía)   │
│    (superficie)   │   resto                          │
│   ~38 %, min 380  │                                  │
└───────────────────┴──────────────────────────────────┘
```

La estructura vive en un solo sitio, `paginas/acceso/marco-acceso.html`, y las cinco
pantallas sin sesión la reciben proyectando su formulario con `<ng-content>`: acceso de
empresa, acceso de plataforma, portal y las dos del restablecimiento. El marco no sabe
nada de campos, validaciones ni API.

**Columna del formulario.** `bg-superficie`, alto completo, `px-8 py-8`. Ocupa todo el
ancho por debajo de `lg` y a partir de ahí se queda en `lg:w-[38%] lg:min-w-95` (380 px),
que es el ancho por debajo del cual los campos empiezan a apretarse. Tiene dos bloques:

1. **Arriba, una barra con la marca a la izquierda y el selector de idioma a la derecha**
   (`flex items-center justify-between`). Va pegada al borde superior y **no** centrada
   con el formulario, por eso la columna dejó de ser `justify-center`.
2. **Centrado verticalmente, el bloque del formulario** (`mx-auto w-full max-w-sm flex-1
   justify-center`): el `<h1>` de la pantalla en `font-titulo` 22 px semibold y centrado,
   debajo la línea de apoyo centrada en `texto-apagado` 13 px, y a `mt-7` el formulario.

**La marca va en dos colores**: la primera parte en `texto` y la segunda en `amarillo`,
19 px, `font-titulo`, `font-extrabold`. Las dos partes salen de `sitio.marca`
(`nucleo/ambiente/sitio.ts`) y no están escritas en la plantilla, para que el nombre siga
cambiándose en un solo archivo; si el nombre cambia hay que mover también el corte,
porque la suma de las dos partes tiene que dar `sitio.nombre`. Los dos `<span>` van
`aria-hidden` y el párrafo lleva `aria-label` con el nombre completo, para que un lector
de pantalla lo lea como una palabra en lugar de deletrear «RETRO, MAQ».

> **El amarillo de la marca no se «arregla».** Da 1.61:1 sobre blanco, muy por debajo del
> 4.5:1 de WCAG 1.4.3, pero **la norma exime expresamente los logotipos y nombres de
> marca** del requisito de contraste. AXE lo va a marcar igual y alguien va a intentar
> corregirlo: no hay que hacerlo. Y la exención **cubre la marca y solo la marca**: en
> cualquier otro texto el amarillo sobre fondo claro sigue prohibido, incluido el enlace
> de «¿Olvidaste tu contraseña?», que por eso va en `texto-secundario`.

**Selector de idioma.** Botón con la bandera, las dos letras del idioma y una flecha que
gira al abrir (`aria-haspopup="listbox"`, `aria-expanded`), y un desplegable
`role="listbox"` con el nombre de cada idioma **en su propio idioma**. La bandera es un
`<img>` y no un emoji: Windows no trae banderas de países en su fuente de emoji —es una
omisión deliberada de Microsoft— y en su lugar dibuja las dos letras del indicador
regional, así que donde debía verse la bandera de México aparecía «MX». El redondeo lo
pone el CSS y no el SVG, porque el `rx` de los archivos es proporcional al lienzo y a
20 px de ancho no se aprecia.

**Elegir un idioma traduce toda la interfaz**, en vivo y sin recargar, y la elección se
recuerda entre visitas. No hay librería de i18n: los textos viven en
`nucleo/i18n/textos.ts` y TypeScript obliga a que los dos idiomas estén completos. Ver
[internacionalización](convenciones.md#internacionalización).

**Columna de marca.** `bg-negro-lateral`, alto completo, `flex-1`. Se oculta por debajo de
`lg` (`hidden lg:flex`) y entonces el formulario ocupa todo el ancho: en un teléfono,
media pantalla decorativa es media pantalla perdida. Va `aria-hidden`: es decoración pura,
no hay nada enfocable dentro y quien usa un lector de pantalla lo que necesita es llegar
al primer campo.

**Ya no lleva ilustración.** Hoy es una **fotografía a sangre**: `background-size: cover`,
`background-position: center 42%` —la máquina está en la banda alta de la foto y centrar
metía muro de más—, `filter: grayscale`, `opacity: 0.4`. Está en la utilidad `foto-marca`
de `styles.css`.

Es **fondo de CSS y no un `<img>`**, y las dos razones son de peso:

1. `NgOptimizedImage` la detectaba como elemento **LCP** y exigía `priority` (NG02955).
   Pero marcarla prioritaria la precargaría **siempre**, incluso en un teléfono, donde
   este panel está oculto y la imagen no se ve nunca. La advertencia pedía justo lo
   contrario de lo que conviene.
2. **El navegador no descarga el fondo de un elemento con `display: none`.** Como el panel
   es `hidden lg:flex`, en móvil la imagen no se pide siquiera. Con un `<img>` eso no se
   consigue de forma fiable.

Que sea un fondo es además lo correcto semánticamente: no hay nada que describir en un
`alt`. **La fotografía puede estar ahí porque no afirma ningún dato.** Lo que sigue vetado
son las métricas de ejemplo: un número inventado se ve igual que uno real y haría creer
que el sistema ya lo calcula.

> El componente `paginas/acceso/ilustracion-acceso.ts` —el SVG en línea que ocupaba este
> panel antes— sigue en disco pero **ya no lo usa nadie**. Lo mismo la utilidad
> `halo-marca` de `styles.css`, que era el degradado que asentaba esa ilustración.

**Campos: rellenos y sin borde.** Es la utilidad `campo-acceso` de `styles.css`:
`bg-superficie-hover`, `rounded-lg`, 1 rem de relleno, 14 px, marcador de posición en
`texto-apagado`. **No** llevan `border border-borde-campo` sobre blanco: aquí no aplica la
regla de `borde-campo`, que existe para los controles cuyo contorno es el único indicio de
que son un control, y este se distingue por su relleno.

**Sin borde, el `outline` de foco es obligatorio** (WCAG 2.4.7): `outline: 2px solid
negro-acento` con `outline-offset: 2px`, para que se lea sobre el propio relleno. No es
negociable, porque no queda ninguna otra señal de dónde está el cursor.

**Botón principal: una píldora.** Es la utilidad `boton-acceso`: a lo ancho,
`border-radius: calc(infinity * 1px)`, `bg-amarillo` con `sobre-amarillo` encima, 14 px
medium, hover en `amarillo-hover`, y deshabilitado en `estado-neutro-fondo` /
`estado-neutro-texto`. **La píldora es una desviación consciente de la escala de radios
del sistema** —donde un botón es `rounded-lg`— y está **acotada a las pantallas de
acceso**: son pantallas de un solo botón, sin nada alrededor con lo que desentonar. Fuera
de los accesos no se usa.

Los dos controles van como utilidades y no como clases sueltas en cada plantilla porque
**seis** pantallas repiten los mismos dos: las cinco del marco más `aceptar-invitacion`,
que todavía usa su propia disposición de una columna pero sí los controles. Con las clases
repetidas, cambiar el alto de un campo eran seis ediciones y la garantía de que una se
quedaría distinta.

### Las etiquetas van en `sr-only`, con el texto en el `placeholder`

El aspecto es el de la referencia de diseño —el campo solo enseña su marcador de
posición—, pero la etiqueta **sigue en el marcado**, oculta con `sr-only`.

Dejar el texto únicamente en el `placeholder` falla **WCAG 3.3.2** por dos motivos
distintos: **desaparece en cuanto se empieza a escribir**, así que quien se distrae ya no
sabe qué iba en ese campo, y **no sirve como nombre accesible** —muchos lectores de
pantalla no lo anuncian—. Con `sr-only` el aspecto es idéntico y el campo conserva su
nombre.

Cuando hay una **instrucción** —«El correo con el que entras a esta empresa. La liga
caduca en una hora»— esa sí se queda a la vista en `texto-apagado` 12 px, enlazada con
`aria-describedby`. Una instrucción no es una etiqueta y no se puede meter en el
`placeholder`.

### El botón de enviar no se deshabilita por formulario inválido

En las dos pantallas de **acceso** —empresa y plataforma— el botón solo se deshabilita
**mientras se envía**, para evitar el doble clic. Nunca por `formulario.invalid`.

La razón es concreta: **el navegador autocompleta el DOM sin que Angular se entere**, así
que el control seguía vacío para el formulario reactivo, el botón salía gris y, con las
credenciales guardadas a la vista en los campos, era imposible entrar. Añadido a eso, un
botón deshabilitado no explica qué falta.

Lo que se hace en su lugar: al pulsar con el formulario inválido se llama
`markAllAsTouched()` y **se dice qué falta** («Escribe tu correo y tu contraseña»). Antes
el clic no producía ningún efecto visible, que es peor que el botón gris.

Las pantallas que **no** reciben autocompletado de credenciales —pedir la liga, definir la
contraseña nueva, elegir empresa— sí pueden deshabilitar por inválido, y lo hacen.

### Enlaces secundarios

13 px, `texto-secundario`, subrayado con `underline-offset-2`, y con `outline` de foco
visible. Dónde van depende de a qué se refieren:

- **«¿Olvidaste tu contraseña?»** va **pegado al campo de contraseña y alineado a la
  izquierda** (`self-start`), no al final de la pantalla: quien lo busca es porque la
  contraseña no le funcionó, y ahí es donde mira.
- **«Volver a entrar»**, en cambio, va **centrado y al final** (`mt-5 text-center`): no se
  refiere a ningún campo, es la salida de la pantalla.

### Lo que NO va en un acceso de este producto

La maqueta de referencia venía de otro producto y traía elementos que aquí serían
mentira:

- **«¿No tienes cuenta? Regístrate»** — no hay registro público. Los usuarios los crea un
  superadministrador por invitación con token de un solo uso.
- **Avisos legales y enlaces a términos o privacidad** — esas páginas no existen todavía.
- **«Recordarme»** — la sesión ya persiste; una casilla que no cambia nada es peor que no
  tenerla.

Lo que sí va: **«¿Olvidaste tu contraseña?»**, pegado al campo de contraseña y alineado a
la izquierda.

Y una cosa que **sí tiene que estar**, aunque la maqueta no la traía: **a qué empresa se
está entrando**. Va como cola destacada de la línea de apoyo —«Ingresa tus datos para
gestionar los activos de **Bajío**»—, en `font-medium text-texto`. Desde que la empresa
sale del subdominio y ya no se escribe, ese nombre es lo único que distingue una pantalla
de acceso de otra y lo único que le avisa a quien llegó desde una liga vieja que está en
la empresa equivocada.

## Lo que no se hace

- **Nada de verde ni rojo.** La paleta es monocroma más amarillo. Un aviso positivo se
  marca con filete negro a la izquierda; uno de atención, con el par `alerta-*`.
- **Nada de `opacity` para apagar contenido.** Arrastra el texto por debajo del contraste
  mínimo. Para eso está el par `estado-neutro-fondo` / `estado-neutro-texto`.
- **`amarillo` nunca como texto sobre fondo claro ni como anillo de foco ahí**: da 1.61:1
  contra `superficie`. Solo como relleno con `sobre-amarillo` encima, como filete, o como
  cifra sobre negro. **La única excepción es el nombre de marca** de la barra superior de
  los accesos, y no por criterio propio: WCAG exime expresamente los logotipos y nombres
  de marca del requisito de contraste. La exención cubre la marca y solo la marca — ver
  §Pantallas de acceso.
- **`texto-tenue` nunca en texto normal**: 3.45:1. Solo texto grande o elementos no
  textuales.
