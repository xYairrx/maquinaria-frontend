# Despliegue en Cloudflare

Un Worker de solo activos, `maquinaria-frontend`, sirviendo `maqvia.com`,
`<empresa>.maqvia.com` y `admin.maqvia.com`:

```
npm run deploy
```

`nucleo/ambiente/configuracion.ts` elige la API leyendo `location.hostname`, así que no
hay build por ambiente ni variables de Cloudflare que sincronizar.

## Alta, una sola vez

1. `npx wrangler login`.
2. En **DNS → Records** del dominio, borrar los registros que quedaron apuntando a
   Vercel (`@`, `*`, `www`, `admin`, `api`, `dev`…). Un CNAME y un A no pueden convivir
   con el mismo nombre, así que mientras estén ahí el alta falla con «A CNAME record
   with that host already exists». **No se tocan los MX ni los TXT**: ahí viven el
   correo y las verificaciones de dominio, y no tienen nada que ver con esto.
3. Dos registros **proxied** (nube naranja):
   - `A  @  192.0.2.0`
   - `A  *  192.0.2.0`

   `192.0.2.0` es la dirección de relleno para orígenes que no existen (RFC 5737): como
   el registro está proxied, la petición nunca sale hacia ahí, la atiende el Worker. El
   comodín es lo que hace que una empresa nueva funcione en `<empresa>.maqvia.com` sin
   dar de alta nada.
4. `npm run deploy`.

## Despliegue automático desde git

Cada push a **`develop`** construye y despliega en vivo, vía Workers Builds. Es la
configuración del dashboard, no vive en el repo, así que queda escrita aquí por si se
desconecta: **Workers & Pages → `maquinaria-frontend` → Settings → Builds**.

| Campo | Valor |
| --- | --- |
| Repositorio | `xYairrx/maquinaria-frontend` |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Branch control | `develop` |
| Non-production branch builds | apagado |

**El Deploy command va sin `--env`, y el `wrangler.jsonc` sin bloque `env`.** No es
descuido: es la lección de haberlo intentado al revés. Con un `env.produccion`, el
Worker se llama `maquinaria-frontend-produccion` y todo despliegue tiene que llevar
`--env produccion`. Falla de las dos maneras posibles:

- Sin el flag, `wrangler deploy` crea un Worker aparte sin rutas. El build queda en
  verde, el sitio no cambia, y no hay nada que se vea roto.
- Con el flag pero conectando el repo desde «Import a repository», el Worker del
  dashboard se llama `maquinaria-frontend` y el del config `…-produccion`. Cloudflare
  exige que coincidan y la compilación falla.

Un solo ambiente no necesita nombrarse. El comando por defecto es el correcto y no hay
nada que olvidar.

Las preview URLs quedan apagadas a propósito. Viven en `*.workers.dev`, que no soporta
subdominio comodín, así que una preview no dejaría probar ninguna empresa —serviría
para ver que compila, y eso ya lo dice el build.

`npm run deploy` sigue funcionando para saltarse el CI.

### Que cada push salga en vivo es una decisión con fecha de caducidad

`develop` publica directo porque hoy no hay clientes y el ciclo corto vale más que la
red de seguridad. Cuando entre el primero, la rama de publicación pasa a `main` y
`develop` vuelve a ser lo que su nombre dice. Es un dropdown, no una migración.

## Por qué NO hay un ambiente `dev` desplegado

Lo hubo y se quitó. El certificado Universal de Cloudflare cubre `maqvia.com` y
`*.maqvia.com`, pero **no un segundo nivel**: `admin.dev.maqvia.com` y
`bajio.dev.maqvia.com` mueren en el handshake con `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`
antes de que nadie mire las rutas. Y como aquí el subdominio ES la empresa, un ambiente
donde solo funciona la raíz no sirve para probar casi nada.

Las salidas de pago existen —Advanced Certificate Manager son 10 USD/mes por
`*.dev.maqvia.com`, y un segundo dominio de desarrollo sale en ~10 USD/año porque el
comodín vuelve al primer nivel— pero mientras no haya clientes en producción, probar
directo en `maqvia.com` sale gratis y se prueba lo mismo.

**Cuando entre el primer cliente esto deja de ser aceptable.** Para entonces: segundo
dominio, una entrada nueva en `AMBIENTES`, y un `env` en `wrangler.jsonc` —y ahí sí,
con dos ambientes, los dos despliegues llevan `--env` y el de producción se renombra.
Es el momento de releer la nota de arriba sobre por qué hoy no hay bloque `env`.

## Caché del navegador

`public/_headers` marca los archivos con hash (`main-*.js`, `chunk-*.js`,
`styles-*.css`) como `immutable` por un año. `index.html`, el favicon y las imágenes de
`public/` se quedan con el `must-revalidate` que Cloudflare pone por defecto, que es lo
que hace que un despliegue nuevo se vea sin vaciar caché. Si algún día el builder cambia
los prefijos de los archivos, hay que cambiarlos ahí también.

## Por qué rutas y no dominios personalizados

Un dominio personalizado se ejecuta DESPUÉS de las rutas. Con un solo Worker da igual,
pero en cuanto haya un segundo la ruta comodín `*.maqvia.com/*` se lo tragaría todo
antes de que el dominio personalizado tuviera oportunidad. Usar rutas en los dos lados
mantiene la regla simple: gana la más específica.

El mismo comodín se traga cualquier subdominio de la zona, `api.maqvia.com` incluido.
Cuando la API viva ahí, hay que darle una ruta propia —`api.maqvia.com/*` sin Worker
asignado, o el Worker que corresponda— o el frontend contestará en su lugar.
