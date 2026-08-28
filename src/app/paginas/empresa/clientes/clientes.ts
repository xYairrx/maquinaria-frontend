import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type {
  AltaCliente,
  Cliente,
  EstadoCliente,
  FiltroClientes,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import {
  validadorCorreo,
  validadorRequerido,
  validadorRfc,
  validadorTelefono,
} from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { ClientesEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los tres de `EstadoCliente`, en el orden del enum del backend. */
const ESTADOS: readonly EstadoCliente[] = [1, 2, 3];

/** `EstadoCliente.Baja`. Con nombre porque es el único irreversible. */
const BAJA: EstadoCliente = 3;

/**
 * Clientes: a quién se le renta.
 *
 * DOS COSAS QUE MANDAN SOBRE EL FORMULARIO:
 *
 * **El contacto y el domicilio van DENTRO del cliente.** Se quitaron las tablas
 * `contacto_cliente` y `domicilio_cliente` el 2026-08-25 y sus campos viven en el propio
 * cliente. El precio, dicho en voz alta: **un cliente tiene UN contacto y UN domicilio**. Si
 * mañana hace falta el domicilio fiscal aparte del de entrega, o dos contactos —cobranza y
 * operación—, hay que volver a sacar la tabla y migrar. En el DTO llegan agrupados en dos
 * objetos, y por eso el formulario los pinta como dos bloques.
 *
 * **El estado es un enum de tres valores** —Activo, Suspendido y Baja— así que igual que el
 * trabajador tiene su propio panel y su propio filtro, no el booleano de serie. La diferencia
 * con trabajadores es que aquí **el cambio no arrastra fecha**: `CambioEstadoCliente` solo
 * lleva el estado, así que no hay CHECK que coordinar. Baja sigue siendo irreversible.
 *
 * Los tres importes se CAPTURAN, no se calculan: la Fase 1 no hace aritmética de crédito.
 */
@Component({
  selector: 'app-clientes',
  imports: [BarraHerramientas, ClientesEsqueleto, ErrorCampo, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clientes.html',
})
export class Clientes {
  private readonly api = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly estados = ESTADOS;
  protected readonly mal = errorVisible;

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoCliente | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroClientes>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'razonsocial',
  }));

  private readonly listado = this.api.clientes.listado(this.filtro);

  protected readonly clientes = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.clientes().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);
  protected readonly panelEstadoAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Cliente | null>(null);
  protected readonly cambiandoEstadoA = signal<Cliente | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', validadorRequerido],
    razonSocial: ['', validadorRequerido],
    nombreComercial: [''],
    rfc: ['', validadorRfc],
    telefono: ['', validadorTelefono],
    correo: ['', validadorCorreo],

    contactoNombre: [''],
    contactoPuesto: [''],
    contactoTelefono: ['', validadorTelefono],
    contactoCorreo: ['', validadorCorreo],

    calle: [''],
    colonia: [''],
    municipio: [''],
    estadoProv: [''],
    codigoPostal: [''],
    pais: ['México'],

    // LOS TRES IMPORTES SON NÚMEROS Y NO PUEDEN SER NULOS en el alta: el backend los declara
    // `decimal` e `int`, no anulables. Un `<input type="number">` escribe `null` al vaciarse,
    // así que se declaran como `number | null` —que es lo que el accesor pone de verdad— y se
    // traducen a 0 al enviar. Declararlos como texto compila y luego revienta con
    // `.trim is not a function`, que es la trampa que ya costó una depuración en Modelos.
    limiteCredito: [0 as number | null],
    diasCredito: [0 as number | null],
    depositoRequerido: [0 as number | null],
    condiciones: [''],
  });

  protected readonly formularioEstado = this.fb.group({
    estado: [1 as EstadoCliente],
  });

  private readonly valoresEstado = toSignal(this.formularioEstado.valueChanges, {
    initialValue: this.formularioEstado.getRawValue(),
  });

  protected readonly esBaja = computed(() => this.valoresEstado().estado === BAJA);

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().clientes.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().clientes.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().clientes.sinClientes;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().clientes.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().clientes.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().clientes.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().clientes.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoCliente): string {
    return t().clientes.estados[estado] ?? String(estado);
  }

  protected situacionDe(estado: EstadoCliente): string {
    return t().clientes.situaciones[estado] ?? '';
  }

  /** El `<select>` entrega TEXTO; `EstadoCliente` es numérico. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoCliente));
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: '',
      razonSocial: '',
      nombreComercial: '',
      rfc: '',
      telefono: '',
      correo: '',
      contactoNombre: '',
      contactoPuesto: '',
      contactoTelefono: '',
      contactoCorreo: '',
      calle: '',
      colonia: '',
      municipio: '',
      estadoProv: '',
      codigoPostal: '',
      pais: 'México',
      // Con 0 y no con null: son obligatorios en el alta, y `reset` con el tipo equivocado
      // devuelve el desajuste que el accesor numérico ya provocó una vez.
      limiteCredito: 0,
      diasCredito: 0,
      depositoRequerido: 0,
      condiciones: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(cliente: Cliente): void {
    this.editando.set(cliente);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: cliente.codigo,
      razonSocial: cliente.razonSocial,
      nombreComercial: cliente.nombreComercial ?? '',
      rfc: cliente.rfc ?? '',
      telefono: cliente.telefono ?? '',
      correo: cliente.correo ?? '',
      contactoNombre: cliente.contacto.nombre ?? '',
      contactoPuesto: cliente.contacto.puesto ?? '',
      contactoTelefono: cliente.contacto.telefono ?? '',
      contactoCorreo: cliente.contacto.correo ?? '',
      calle: cliente.domicilio.calle ?? '',
      colonia: cliente.domicilio.colonia ?? '',
      municipio: cliente.domicilio.municipio ?? '',
      estadoProv: cliente.domicilio.estadoProv ?? '',
      codigoPostal: cliente.domicilio.codigoPostal ?? '',
      pais: cliente.domicilio.pais,
      limiteCredito: cliente.limiteCredito,
      diasCredito: cliente.diasCredito,
      depositoRequerido: cliente.depositoRequerido,
      condiciones: cliente.condiciones ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected abrirEstado(cliente: Cliente): void {
    this.cambiandoEstadoA.set(cliente);
    this.errorMutacion.set(null);
    this.formularioEstado.reset({ estado: cliente.estado });
    this.panelEstadoAbierto.set(true);
  }

  protected cerrarPanelEstado(): void {
    this.panelEstadoAbierto.set(false);
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();
    const vacioANulo = (texto: string) => (texto.trim() === '' ? null : texto.trim());

    const alta = {
      codigo: v.codigo.trim().toUpperCase(),
      razonSocial: v.razonSocial.trim(),
      nombreComercial: vacioANulo(v.nombreComercial),
      rfc: vacioANulo(v.rfc.toUpperCase()),
      telefono: vacioANulo(v.telefono),
      correo: vacioANulo(v.correo.toLowerCase()),
      contacto: {
        nombre: vacioANulo(v.contactoNombre),
        puesto: vacioANulo(v.contactoPuesto),
        telefono: vacioANulo(v.contactoTelefono),
        correo: vacioANulo(v.contactoCorreo.toLowerCase()),
      },
      domicilio: {
        calle: vacioANulo(v.calle),
        colonia: vacioANulo(v.colonia),
        municipio: vacioANulo(v.municipio),
        estadoProv: vacioANulo(v.estadoProv),
        codigoPostal: vacioANulo(v.codigoPostal),
        pais: v.pais.trim() || 'México',
        // No se capturan: el alta no los ofrece y el servidor los admite nulos.
        latitud: null,
        longitud: null,
      },
      // `?? 0` porque un campo numérico vaciado escribe `null`, y los tres son obligatorios.
      limiteCredito: v.limiteCredito ?? 0,
      diasCredito: Math.trunc(v.diasCredito ?? 0),
      depositoRequerido: v.depositoRequerido ?? 0,
      condiciones: vacioANulo(v.condiciones),
    } satisfies AltaCliente;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.clientes.editar(enEdicion.id, alta)
      : this.api.clientes.crear(alta);

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

  protected async enviarEstado(): Promise<void> {
    const cliente = this.cambiandoEstadoA();

    if (cliente === null || this.enviando()) {
      return;
    }

    const v = this.formularioEstado.getRawValue();

    // La baja no se puede deshacer. Suspendido sí —cartera, siniestro— y no la merece.
    if (v.estado === BAJA) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().clientes.darDeBaja,
        mensaje: t().clientes.confirmarBaja(cliente.razonSocial),
        confirmar: t().clientes.darDeBaja,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api.cambiarEstadoCliente(cliente.id, { estado: v.estado }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanelEstado();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
