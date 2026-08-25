import { describe, expect, it } from 'vitest';
import { puedeVerModulo } from './acceso';
import type { IdentidadEmpresa } from '../api/contratos';

const identidad = (parcial: Partial<IdentidadEmpresa> = {}): IdentidadEmpresa => ({
  correo: 'persona@ejemplo.com',
  nombre: 'Persona',
  empresa: 'bajio',
  razonSocial: 'Maquinaria del Bajío SA de CV',
  accesoTotal: false,
  permisos: [],
  modulos: [],
  ...parcial,
});

describe('puedeVerModulo', () => {
  it('una opción sin módulo se ve siempre', () => {
    expect(puedeVerModulo(identidad(), undefined)).toBe(true);
  });

  it('sin identidad no se ve ningún módulo', () => {
    expect(puedeVerModulo(null, 'equipos')).toBe(false);
  });

  it('con permiso y módulo en el plan, se ve', () => {
    const yo = identidad({ modulos: ['equipos'], permisos: ['equipos.consultar'] });

    expect(puedeVerModulo(yo, 'equipos')).toBe(true);
  });

  it('EL CASO: con permiso del rol pero sin el módulo en el plan, NO se ve', () => {
    // Un usuario con logistica.crear en una empresa cuyo plan no incluye logística no
    // puede crear un flete. Enseñarle el módulo es ofrecerle un 403.
    const yo = identidad({ modulos: ['equipos'], permisos: ['logistica.crear'] });

    expect(puedeVerModulo(yo, 'logistica')).toBe(false);
  });

  it('con el módulo en el plan pero sin ningún permiso, NO se ve', () => {
    const yo = identidad({ modulos: ['equipos'], permisos: ['rentas.consultar'] });

    expect(puedeVerModulo(yo, 'equipos')).toBe(false);
  });

  it('acceso total ve cualquier módulo del plan', () => {
    const yo = identidad({ accesoTotal: true, modulos: ['equipos', 'rentas'], permisos: [] });

    expect(puedeVerModulo(yo, 'equipos')).toBe(true);
    expect(puedeVerModulo(yo, 'rentas')).toBe(true);
  });

  it('acceso total NO ve un módulo fuera del plan', () => {
    // El plan del tenant manda incluso sobre acceso_total: no está contratado.
    const yo = identidad({ accesoTotal: true, modulos: ['equipos'], permisos: [] });

    expect(puedeVerModulo(yo, 'logistica')).toBe(false);
  });

  it('un permiso de otro módulo con prefijo parecido no cuenta', () => {
    // 'equipos-pesados.editar' no es un permiso de 'equipos'.
    const yo = identidad({ modulos: ['equipos'], permisos: ['equipos-pesados.editar'] });

    expect(puedeVerModulo(yo, 'equipos')).toBe(false);
  });
});
