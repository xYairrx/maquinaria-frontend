/**
 * La identidad del sitio: cómo se llama el producto y cómo se describe.
 *
 * Existe para que el nombre esté escrito UNA vez. Antes vivía repetido en las dos
 * disposiciones, en el marco de acceso y en `index.html`, y cambiarlo obligaba a
 * recordar los cuatro sitios; el que se olvidara quedaba con el nombre viejo, que es
 * exactamente el tipo de error que nadie nota hasta que lo ve un cliente.
 *
 * Está separado de `configuracion.ts` a propósito: aquello responde «¿dónde estoy?»
 * —la URL de la API, el dominio base— y esto responde «¿qué producto es este?». Cambian
 * por motivos distintos y en momentos distintos.
 *
 * HAY UNA COPIA A MANO, Y ES OBLIGATORIO ACTUALIZARLA: el `<title>` de `src/index.html`.
 * Ese archivo es HTML estático servido antes de que arranque Angular, así que no puede
 * importar este módulo ni leer nada de él; la sincronización es manual y no hay compilador
 * que la vigile. Ya se desincronizó dos veces —el `<title>` se quedó en «Maquinaria»— y
 * las dos costó lo mismo notarlo: solo se ve el primer instante, hasta que el router
 * navega, pero es el nombre que sale al compartir la pestaña o al guardarla en favoritos.
 * Lo mismo aplica al `<html lang>` de ese archivo y al campo `idioma` de aquí abajo.
 *
 * Ojo con lo que NO se centraliza aquí: el nombre del remitente de los correos vive en
 * `Correo:NombreRemitente` del backend, y `package.json` lleva el nombre del paquete.
 * Un cambio de marca tiene que tocar esos dos también.
 */
export const sitio = {
  /**
   * El nombre del producto. Se ve en el menú, en los accesos y en la pestaña.
   *
   * Si cambia, cambia también el `<title>` de `src/index.html` a mano. Ver la nota de
   * arriba: es la única copia que ningún compilador comprueba.
   */
  nombre: 'MAQVIA ERP',

  /**
   * El nombre partido en dos, para pintarlo con dos colores.
   *
   * Va aquí y no escrito en la plantilla para que siga habiendo UN solo sitio donde
   * cambiar la marca. Si el nombre cambia, hay que mover también el corte: la suma de
   * las dos partes tiene que dar `nombre`.
   */
  marca: {
    /** Primera parte, en el color de texto. */
    inicio: 'MAQVIA',
    /** Segunda parte, en amarillo. */
    fin: 'ERP',
  },

  /**
   * La frase que acompaña al nombre en el panel de marca de los accesos. Una línea, sin
   * punto final si algún día se usa en un sitio donde no cierre la oración.
   */
  descripcion: 'Operación y rentabilidad de activos, en un solo lugar.',

  /**
   * El idioma del documento. Va en `<html lang>` y lo usan los lectores de pantalla para
   * elegir la voz y la pronunciación; con `en` leerían el español con fonética inglesa
   * (WCAG 3.1.1). Es `es-MX` y no `es` porque también decide el formato de fechas y
   * números cuando se registre el locale.
   */
  idioma: 'es-MX',
} as const;
