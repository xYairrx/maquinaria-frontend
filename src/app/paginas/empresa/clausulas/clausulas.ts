import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import type { AltaClausula, Clausula, FiltroClausulas } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { ClausulasEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Cláusulas: el catálogo del que se enganchan las de cada contrato.
 *
 * MISMA FORMA QUE MARCAS —lo común está razonado en `marcas.ts`—. Tres diferencias:
 *
 * **El texto es largo**, así que va en un `<textarea>` y no en un `<input>`, y en la tabla se
 * recorta a tres líneas. Es lo único de los siete catálogos que no cabe en una celda.
 *
 * **`orden` decide cómo se imprimen en el contrato**, no cómo se listan aquí. Por eso la
 * tabla se ordena por ese campo y no por el título: verla en el orden en que va a salir
 * impresa es más útil que verla alfabética.
 *
 * **`obligatoria` no es un estado, es una propiedad.** Una cláusula obligatoria entra en
 * todo contrato sin que nadie la elija; retirarla es lo que la saca. De ahí que sea un
 * filtro aparte del de activas, y no un tercer valor de ese.
 */
@Component({
  selector: 'app-clausulas',
  imports: [BarraHerramientas, ClausulasEsqueleto, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clausulas.html',
})
export class Clausulas {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivas = signal<boolean | undefined>(undefined);

  /** `undefined` = obligatorias y opcionales. Filtra en el servidor con `Obligatoria`. */
  protected readonly soloObligatorias = signal<boolean | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroClausulas>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivas(),
    Obligatoria: this.soloObligatorias(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    // Por `orden`, que es como van a salir impresas en el contrato.
    Orden: 'orden',
  }));

  private readonly listado = this.api.clausulas.listado(this.filtro);

  protected readonly clausulas = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.clausulas().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Clausula | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    texto: ['', Validators.required],
    // NÚMERO, no texto. Lo decide el `NumberValueAccessor` del `<input type="number">`, que
    // escribe un number en el control —y `null` si se vacía—, se declare como se declare.
    // `required` cubre ese `null`; declararlo como texto seguiría siendo mentira.
    orden: [0 as number | null, Validators.required],
    obligatoria: [false],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().clausulas.sinResultados(texto);
    }

    if (this.soloObligatorias() === true) {
      return t().clausulas.sinObligatorias;
    }

    if (this.soloObligatorias() === false) {
      return t().clausulas.sinOpcionales;
    }

    if (this.soloActivas() === true) {
      return t().clausulas.sinActivas;
    }

    if (this.soloActivas() === false) {
      return t().clausulas.sinRetiradas;
    }

    return t().clausulas.sinClausulas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().clausulas.contextoResultados(n);
    }

    if (this.soloActivas() === true) {
      return t().clausulas.contextoActivas(n);
    }

    if (this.soloActivas() === false) {
      return t().clausulas.contextoRetiradas(n);
    }

    return t().clausulas.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().clausulas.titulo,
        contexto: this.contexto(),
        // NI BUSQUEDA NI ACCION AQUI: bajaron a `app-barra-herramientas`, encima de la tabla.
        // Ver el porque en `marcas.ts`, la pantalla canonica.
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloActivas();
      this.soloObligatorias();
      this.pagina.set(1);
    });
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({ codigo: '', titulo: '', texto: '', orden: 0, obligatoria: false });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(clausula: Clausula): void {
    this.editando.set(clausula);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: clausula.codigo,
      titulo: clausula.titulo,
      texto: clausula.texto,
      orden: clausula.orden,
      obligatoria: clausula.obligatoria,
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected filtrarObligatorias(valor: boolean | undefined): void {
    this.soloObligatorias.set(valor);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();

    const alta = {
      codigo: v.codigo.trim(),
      titulo: v.titulo.trim(),
      texto: v.texto.trim(),
      orden: Math.trunc(v.orden ?? 0),
      obligatoria: v.obligatoria,
    } satisfies AltaClausula;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.clausulas.editar(enEdicion.id, alta)
      : this.api.clausulas.crear(alta);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected async alternarActivo(clausula: Clausula): Promise<void> {
    if (clausula.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().clausulas.retirar,
        // Retirar una OBLIGATORIA es más grave: deja de entrar sola en los contratos
        // nuevos, y eso se dice en voz alta en vez de usar el mismo texto para las dos.
        mensaje: clausula.obligatoria
          ? t().clausulas.confirmarRetiroObligatoria(clausula.titulo)
          : t().clausulas.confirmarRetiro(clausula.titulo),
        confirmar: t().clausulas.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.clausulas.cambiarActivo(clausula.id, !clausula.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }

  /**
   * El filtro de obligatoriedad, desde el `<select>`.
   *
   * Un `<option>` solo lleva texto, asi que los tres estados viajan con nombre y se
   * traducen aqui. La conversion no va en la plantilla: alli seria logica escondida en un
   * binding, que es justo lo que las convenciones piden no hacer.
   */
  protected elegirObligatorias(valor: string): void {
    this.filtrarObligatorias(valor === 'cualquiera' ? undefined : valor === 'obligatorias');
  }
}
