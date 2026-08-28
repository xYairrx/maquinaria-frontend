import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  MAXIMO_LARGO_CORREO,
  correoEsValido,
  normalizarCorreo,
  normalizarRfc,
  normalizarTelefono,
  rfcEsValido,
  soloDigitos,
  telefonoEsValido,
  validadorCantidad,
  validadorImporte,
  validadorRequerido,
} from './validadores';

/**
 * Las reglas de RFC, teléfono y correo, probadas SIN navegador y SIN HTTP porque son
 * funciones puras: es justo lo que se gana al sacarlas del componente.
 *
 * Lo que fija este archivo no es que «funcionen»: es cada caso concreto que se reportó o que
 * se puede colar. Un RFC con `Ñ`, un teléfono con letras, un `a@b` que `Validators.email`
 * daba por bueno. Si alguien reescribe un patrón «más simple», aquí se entera.
 */

describe('rfcEsValido', () => {
  it('acepta los 12 caracteres de una persona moral', () => {
    // 3 letras de razón social + 6 de la fecha + 3 de homoclave.
    expect(rfcEsValido('MAQ940101AB1')).toBe(true);
  });

  it('acepta los 13 caracteres de una persona física', () => {
    // 4 letras del nombre y los mismos 9. LOS DOS LARGOS SON VÁLIDOS: ninguno es «el bueno».
    expect(rfcEsValido('PEGJ850315HX9')).toBe(true);
  });

  it('acepta la Ñ, que es un carácter legítimo de un RFC real', () => {
    // Un patrón que solo admita `A-Z` rechaza a «CAÑADA». Es una empresa que existe.
    expect(rfcEsValido('CAÑ030612QW2')).toBe(true);
  });

  it('acepta el &, por la misma razón', () => {
    // «Pemex & Cía». Mismo caso que la Ñ y el mismo fallo si se recorta el patrón.
    expect(rfcEsValido('A&B030612QW2')).toBe(true);
  });

  it('rechaza 11 caracteres', () => {
    // El fallo reportado era que admitía cualquier longitud.
    expect(rfcEsValido('MAQ940101A')).toBe(false);
  });

  it('rechaza 14 caracteres', () => {
    expect(rfcEsValido('MAQUI940101AB1')).toBe(false);
  });

  it('rechaza letras en la zona de la fecha', () => {
    // Los 6 del centro son la fecha y son dígitos: sin esto, `MAQ9401O1AB1` —con la letra O
    // en lugar del cero— pasaría, y es el error de captura más común que hay.
    expect(rfcEsValido('MAQ9401O1AB1')).toBe(false);
  });

  it('acepta vacío, porque el RFC es opcional', () => {
    expect(rfcEsValido('')).toBe(true);
  });

  it('normaliza antes de validar: minúsculas y espacios pegados de un PDF', () => {
    // Es el MISMO RFC. Si la normalización no fuera antes de validar, el mismo dato se
    // aceptaría o se rechazaría según cómo se pegó.
    expect(rfcEsValido('  maq 940101 ab1 ')).toBe(true);
    expect(normalizarRfc('  maq 940101 ab1 ')).toBe('MAQ940101AB1');
  });
});

describe('telefonoEsValido', () => {
  it('acepta 10 dígitos, que es el número nacional mexicano', () => {
    expect(telefonoEsValido('5512345678')).toBe(true);
  });

  it('RECHAZA separadores: solo números', () => {
    // Los admitía hasta el 2026-08-26. Se cambió por petición expresa, y el argumento nuevo
    // es mejor: guardando «(55) 1234 5678» y «5512345678» como valores distintos, el mismo
    // teléfono son dos, y el día que haya que buscar por teléfono no coinciden.
    expect(telefonoEsValido('+52 (55) 1234-5678')).toBe(false);
    expect(telefonoEsValido('55 1234 5678')).toBe(false);
    expect(telefonoEsValido('55-1234-5678')).toBe(false);
  });

  it('acepta 12 dígitos con lada internacional, pegados', () => {
    expect(telefonoEsValido('525512345678')).toBe(true);
  });

  it('`soloDigitos` es lo que el campo usa para que no se puedan ni teclear', () => {
    // La otra mitad de la regla: el patrón dice qué se acepta y esto dice cómo se llega ahí
    // sin que quien captura tenga que borrar a mano lo que pegó.
    expect(soloDigitos('+52 (55) 1234-5678')).toBe('525512345678');
    expect(soloDigitos('55 URGENCIAS')).toBe('55');
    expect(soloDigitos('')).toBe('');
  });

  it('`normalizarTelefono` recorta las puntas y NO limpia separadores', () => {
    // Si limpiara, «55.1234.5678» pasaría la validación y «solo números» sería mentira.
    expect(normalizarTelefono('  5512345678  ')).toBe('5512345678');
    expect(normalizarTelefono('55.1234.5678')).toBe('55.1234.5678');
  });

  it('rechaza letras', () => {
    // El fallo reportado: el campo no tenía un solo validador y admitía cualquier cosa.
    expect(telefonoEsValido('55 URGENCIAS')).toBe(false);
    expect(telefonoEsValido('551234567X')).toBe(false);
  });

  it('rechaza 9 dígitos', () => {
    expect(telefonoEsValido('551234567')).toBe(false);
  });

  it('rechaza 16 dígitos', () => {
    // 15 es el tope de E.164: el número más largo que puede existir en el mundo.
    expect(telefonoEsValido('1234567890123456')).toBe(false);
  });

  it('un montón de separadores sin dígitos no es un teléfono', () => {
    expect(telefonoEsValido('(--) -- -- --')).toBe(false);
  });

  it('acepta vacío, porque el teléfono es opcional', () => {
    expect(telefonoEsValido('')).toBe(true);
    expect(telefonoEsValido('   ')).toBe(true);
  });
});

describe('correoEsValido', () => {
  it('rechaza algo sin arroba', () => {
    expect(correoEsValido('hola')).toBe(false);
  });

  it('rechaza a@b, que es lo que Validators.email daba por bueno', () => {
    // ESTE ES EL CASO QUE MOTIVÓ SUSTITUIR `Validators.email`. Un dominio sin punto no lo
    // entrega ningún servidor de internet, y por ahí va la invitación del administrador.
    expect(correoEsValido('a@b')).toBe(false);
  });

  it('rechaza un TLD de una sola letra', () => {
    expect(correoEsValido('a@b.c')).toBe(false);
  });

  it('rechaza espacios', () => {
    expect(correoEsValido('admin bajio@ejemplo.mx')).toBe(false);
    expect(correoEsValido('admin@ejem plo.mx')).toBe(false);
  });

  it('rechaza dos arrobas', () => {
    expect(correoEsValido('admin@bajio@ejemplo.mx')).toBe(false);
  });

  it('rechaza 255 caracteres y acepta 254', () => {
    // El tope de RFC 5321: más allá, ningún MTA la acepta.
    const cola = '@ejemplo.mx';
    const justo = 'a'.repeat(MAXIMO_LARGO_CORREO - cola.length) + cola;

    expect(justo).toHaveLength(254);
    expect(correoEsValido(justo)).toBe(true);
    expect(correoEsValido('a' + justo)).toBe(false);
  });

  it('acepta uno normal, y lo normaliza a minúsculas', () => {
    expect(correoEsValido('admin@bajio.mx')).toBe(true);
    expect(correoEsValido('  Admin@Bajio.MX  ')).toBe(true);
    expect(normalizarCorreo('  Admin@Bajio.MX  ')).toBe('admin@bajio.mx');
  });

  it('acepta subdominios y puntos en la parte local', () => {
    expect(correoEsValido('juan.perez@correo.bajio.com.mx')).toBe(true);
  });

  it('rechaza vacío: el correo del administrador es obligatorio', () => {
    expect(correoEsValido('')).toBe(false);
  });
});

describe('validadorRequerido', () => {
  const control = (valor: string) => new FormControl(valor, validadorRequerido);

  it('rechaza un campo de SOLO ESPACIOS, que es lo que `Validators.required` daba por bueno', () => {
    // El hueco que cierra: con `Validators.required`, '   ' pasaba el cliente y lo rechazaba
    // el servidor con un «Datos incompletos» genérico, sin decir qué campo faltaba.
    expect(control('   ').valid).toBe(false);
  });

  it('rechaza el vacío, como el de Angular', () => {
    expect(control('').valid).toBe(false);
  });

  it('devuelve la clave `required` y no una nueva', () => {
    // Es la que Angular ya usa y la que cualquier plantilla existente comprueba.
    expect(control('').errors).toEqual({ required: true });
  });

  it('acepta un valor con espacios alrededor: recortar no es rechazar', () => {
    expect(control('  Grupo Teckio  ').valid).toBe(true);
  });
});

/** Un control con el valor ya puesto, tal como lo deja un accesor de valor. */
const crudo = (valor: unknown) => new FormControl(valor);

/**
 * `validadorRequerido` ES SOLO PARA TEXTO, Y EN UN CAMPO NUMÉRICO NUNCA DEJA ENVIAR.
 *
 * Pasa por `texto()`, que devuelve `''` para cualquier valor que no sea una cadena. Un
 * `<input type="number">` mete un **number** en el control —o `null` al vaciarse—, así que el
 * validador ve `''`, lo declara vacío y devuelve `{ required: true }` **se escriba lo que se
 * escriba**.
 *
 * El síntoma que provocó, en el alta de línea de una cotización: el formulario se veía completo,
 * no salía ni un mensaje de error —los avisos aparecen con `touched` y el campo se había
 * rellenado sin tocarlo— y el botón de guardar simplemente estaba apagado. Nada en la pantalla
 * decía por qué.
 *
 * Es la misma familia que la trampa del `NumberValueAccessor` fijada en `modelos.spec.ts`: lo
 * que acaba dentro del control lo decide el ACCESOR, no la declaración del formulario.
 */
describe('validadorRequerido sobre un valor numérico', () => {
  it('rechaza un número perfectamente válido — este es el defecto que documenta', () => {
    expect(validadorRequerido(crudo(3))).toEqual({ required: true });
    expect(validadorRequerido(crudo(1500))).toEqual({ required: true });
  });
});

/**
 * Los dos numéricos. Sus límites son los del SERVIDOR, no una preferencia de la pantalla:
 * `AgregarLineaAsync` responde 400 con «La cantidad tiene que ser mayor que cero» y «El precio
 * no puede ser negativo».
 */
describe('validadorCantidad', () => {
  it('acepta un número mayor que cero, con decimales incluidos', () => {
    expect(validadorCantidad(crudo(1))).toBeNull();
    expect(validadorCantidad(crudo(2.5))).toBeNull();
  });

  it('rechaza el cero y el negativo, que es lo que el servidor rechaza', () => {
    expect(validadorCantidad(crudo(0))).toEqual({ required: true });
    expect(validadorCantidad(crudo(-1))).toEqual({ required: true });
  });

  it('rechaza el campo vacío, que llega como null y no como cadena', () => {
    expect(validadorCantidad(crudo(null))).toEqual({ required: true });
  });

  it('rechaza una cadena aunque parezca un número', () => {
    expect(validadorCantidad(crudo('3'))).toEqual({ required: true });
  });
});

describe('validadorImporte', () => {
  it('acepta el cero: una línea de cortesía es válida', () => {
    expect(validadorImporte(crudo(0))).toBeNull();
    expect(validadorImporte(crudo(1500.5))).toBeNull();
  });

  it('rechaza el negativo y el vacío', () => {
    expect(validadorImporte(crudo(-0.01))).toEqual({ required: true });
    expect(validadorImporte(crudo(null))).toEqual({ required: true });
  });
});
