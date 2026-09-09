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
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiSeguridad } from '../../../nucleo/api/api-seguridad';
import type {
  EstadoUsuario,
  FiltroUsuariosEmpresa,
  UsuarioEmpresa,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorCorreo, validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { UsuariosEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los cuatro de `EstadoUsuario`, en el orden del enum. */
const ESTADOS: readonly EstadoUsuario[] = [1, 2, 3, 4];

/**
 * Los usuarios de la empresa: quién entra, con qué rol y en qué estado.
 *
 * **NO HAY BORRAR, y no es una omisión**: los usuarios no se borran, viven en un estado. Dar de
 * baja es una acción de fila. Borrarlos partiría la bitácora —que guarda su id— y liberaría un
 * correo que el UNIQUE global no vuelve a admitir.
 *
 * **NO HAY «CREAR CON CONTRASEÑA».** Se invita, y la persona la define al abrir la liga. Es lo
 * que impide que quien administra conozca la contraseña de nadie.
 *
 * **LA LIGA SE MUESTRA EN LA PANTALLA, no dentro del panel**, y es la misma decisión que el
 * alta de una empresa: el panel se cierra con el mismo gesto que lo abrió, y la liga tiene que
 * poder leerse y copiarse. Existe solo en esa respuesta —del token solo se guarda el hash—, así
 * que si se pierde hay que reenviar, y reenviar invalida la anterior.
 *
 * **AL DE ACCESO TOTAL NO SE LE TOCAN LOS ROLES.** Ese rol se otorga al aprovisionar la empresa
 * y el servidor rechaza asignarlo o quitarlo; la fila lo dice y no ofrece la acción, en lugar
 * de dejar que el usuario descubra el 409.
 */
@Component({
  selector: 'app-usuarios',
  imports: [BarraHerramientas, ErrorCampo, PanelLateral, ReactiveFormsModule, UsuariosEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios.html',
})
export class Usuarios {
  private readonly api = inject(ApiSeguridad);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;
  protected readonly estados = ESTADOS;

  private readonly listaRoles = this.api.roles();

  /**
   * Los roles ASIGNABLES: todos menos el de acceso total.
   *
   * Se filtra aquí y no en el servidor porque el listado de roles sirve también a la pantalla
   * de Roles, donde el de acceso total SÍ se muestra —es el que explica a los demás—.
   */
  protected readonly rolesAsignables = computed(() =>
    this.listaRoles.roles().filter((r) => !r.accesoTotal),
  );

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltro = signal<EstadoUsuario | undefined>(undefined);
  protected readonly rolFiltro = signal('');
  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroUsuariosEmpresa>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltro(),
    RolId: this.rolFiltro() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.listadoUsuarios(this.filtro);

  protected readonly usuarios = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.usuarios().length === 0,
  );

  protected readonly recargando = this.listado.cargando;
  protected readonly enviando = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  /** La liga recién emitida. Se queda en pantalla hasta que alguien la descarta. */
  protected readonly ligaEmitida = signal<{ correo: string; liga: string } | null>(null);

  protected readonly panelAbierto = signal(false);
  protected readonly editando = signal<UsuarioEmpresa | null>(null);

  /** A quién se le están cambiando los roles. Su propio panel. */
  protected readonly asignando = signal<UsuarioEmpresa | null>(null);
  protected readonly rolesElegidos = signal<readonly string[]>([]);

  protected readonly formulario = this.fb.group({
    correo: ['', [validadorRequerido, validadorCorreo]],
    nombre: ['', validadorRequerido],
    apellidos: [''],
    telefono: [''],
  });

  /** Los roles con los que nace el invitado. Fuera del formulario: son casillas, no un campo. */
  protected readonly rolesNuevos = signal<readonly string[]>([]);

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().usuarios.sinResultados(texto);
    }

    if (this.estadoFiltro() !== undefined) {
      return t().usuarios.sinDeEstado(this.nombreEstado(this.estadoFiltro()!));
    }

    if (this.rolFiltro() !== '') {
      return t().usuarios.sinDeRol;
    }

    return t().usuarios.sinFilas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().usuarios.contextoResultados(n);
    }

    if (this.estadoFiltro() !== undefined) {
      return t().usuarios.contextoDeEstado(n, this.nombreEstado(this.estadoFiltro()!));
    }

    return t().usuarios.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().usuarios.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: { etiqueta: t().usuarios.invitar, alPulsar: () => this.abrirAlta() },
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltro();
      this.rolFiltro();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoUsuario): string {
    return t().usuarios.estados[estado] ?? String(estado);
  }

  protected filtrarPorEstado(valor: string): void {
    this.estadoFiltro.set(valor === '' ? undefined : (Number(valor) as EstadoUsuario));
  }

  protected filtrarPorRol(id: string): void {
    this.rolFiltro.set(id);
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
    this.rolesNuevos.set([]);
    this.formulario.reset({ correo: '', nombre: '', apellidos: '', telefono: '' });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(usuario: UsuarioEmpresa): void {
    this.editando.set(usuario);
    this.errorMutacion.set(null);
    this.formulario.reset({
      // EL CORREO NO SE EDITA: es la llave del login y lo que la bitácora congela. Se muestra
      // deshabilitado con `[attr.disabled]`, no con `control.disable()` — eso lo sacaría del
      // valor del formulario.
      correo: usuario.correo,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos ?? '',
      telefono: usuario.telefono ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected alternarRolNuevo(id: string): void {
    this.rolesNuevos.update((actuales) =>
      actuales.includes(id) ? actuales.filter((r) => r !== id) : [...actuales, id],
    );
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
    const enEdicion = this.editando();

    if (enEdicion !== null) {
      this.api
        .editarUsuario(enEdicion.id, {
          nombre: v.nombre.trim(),
          apellidos: vacioANulo(v.apellidos),
          telefono: vacioANulo(v.telefono),
        })
        .subscribe({
          next: () => {
            this.enviando.set(false);
            this.cerrarPanel();
          },
          error: (e: unknown) => {
            this.errorMutacion.set(mensajeDeError(e));
            this.enviando.set(false);
          },
        });

      return;
    }

    this.api
      .invitar({
        correo: v.correo.trim().toLowerCase(),
        nombre: v.nombre.trim(),
        apellidos: vacioANulo(v.apellidos),
        telefono: vacioANulo(v.telefono),
        rolesIds: [...this.rolesNuevos()],
      })
      .subscribe({
        next: (emitida) => {
          this.enviando.set(false);
          this.cerrarPanel();
          // La liga se queda en la PANTALLA, no en el panel: el panel se cierra con el mismo
          // gesto que lo abrió y la liga tiene que poder copiarse.
          this.ligaEmitida.set({ correo: emitida.usuario.correo, liga: emitida.liga });
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  /**
   * Reenvía la invitación. **Pregunta antes**, porque invalida la liga anterior: si la persona
   * ya la tenía en su correo, deja de servirle.
   */
  protected async reenviar(usuario: UsuarioEmpresa): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().usuarios.reenviar,
      mensaje: t().usuarios.confirmarReenvio(usuario.correo),
      confirmar: t().usuarios.reenviar,
      peligro: false,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.reenviarInvitacion(usuario.id).subscribe({
      next: (emitida) =>
        this.ligaEmitida.set({ correo: emitida.usuario.correo, liga: emitida.liga }),
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }

  /**
   * Cambia el estado. **Suspender y dar de baja preguntan**; activar no, que es devolver el
   * acceso.
   */
  protected async cambiarEstado(usuario: UsuarioEmpresa, estado: EstadoUsuario): Promise<void> {
    if (estado === usuario.estado) {
      return;
    }

    if (estado === 3 || estado === 4) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().usuarios.cerrarAcceso,
        mensaje: t().usuarios.confirmarCierre(usuario.correo, this.nombreEstado(estado)),
        confirmar: t().usuarios.cerrarAcceso,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.cambiarEstadoUsuario(usuario.id, estado).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }

  /** El `<select>` de la fila entrega cadena; el estrechamiento se hace aquí, no en la plantilla. */
  protected alElegirEstado(usuario: UsuarioEmpresa, valor: string): void {
    void this.cambiarEstado(usuario, Number(valor) as EstadoUsuario);
  }

  protected abrirRoles(usuario: UsuarioEmpresa): void {
    this.asignando.set(usuario);
    this.rolesElegidos.set([...usuario.rolesIds]);
    this.errorMutacion.set(null);
  }

  protected cerrarRoles(): void {
    this.asignando.set(null);
  }

  protected alternarRol(id: string): void {
    this.rolesElegidos.update((actuales) =>
      actuales.includes(id) ? actuales.filter((r) => r !== id) : [...actuales, id],
    );
  }

  protected guardarRoles(): void {
    const usuario = this.asignando();

    if (usuario === null) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api.asignarRoles(usuario.id, this.rolesElegidos()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarRoles();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected descartarLiga(): void {
    this.ligaEmitida.set(null);
  }

  /**
   * Copia la liga al portapapeles.
   *
   * **Falla en silencio a propósito**: sin permiso del navegador o en un contexto no seguro
   * `writeText` rechaza, y la liga sigue visible y seleccionable en pantalla — que es la vía
   * que siempre funciona. Un aviso de error aquí sería ruido sobre algo que ya se puede hacer
   * a mano.
   */
  protected copiar(liga: string): void {
    void navigator.clipboard?.writeText(liga).catch(() => undefined);
  }
}
