import type { Equipo, UnidadTarifa } from './contratos';

/**
 * EL COSTO QUE UNA MÁQUINA TIENE CARGADO PARA UNA UNIDAD DE TIEMPO.
 *
 * **ES EL ESPEJO DE UN `switch` DEL SERVIDOR**, y hay que decirlo: `ServicioRentasEf` y
 * `ServicioCotizacionesEf` hacen exactamente esta elección cuando el costo de la línea llega en
 * blanco. Aquí se repite **solo para enseñar el cálculo antes de guardar** — «2.54 Día ×
 * $2,500 = $6,350» — porque un número que aparece después de guardar no se revisa.
 *
 * Si los dos se separan, la pantalla dirá un número y se guardará otro, y nada avisará. De ahí
 * que viva en un solo sitio, con pruebas, en lugar de dentro del `computed` de una pantalla.
 *
 * **Las unidades que no son de tiempo devuelven `null`, no cero**, y la diferencia importa: un
 * flete por Evento no tiene «costo de máquina», mientras que cero es una máquina a la que no se
 * le cargó el de esa unidad. El CHECK `renta_unidad` limita el documento a las cuatro de tiempo,
 * pero eso lo sabe la base y no el tipo — `UnidadTarifa` tiene seis valores.
 */
export function costoDelEquipoPorUnidad(equipo: Equipo, unidad: UnidadTarifa): number | null {
  switch (unidad) {
    case 1:
      return equipo.tarifaHora;
    case 2:
      return equipo.tarifaDia;
    case 3:
      return equipo.tarifaSemana;
    case 4:
      return equipo.tarifaMes;
    default:
      return null;
  }
}
