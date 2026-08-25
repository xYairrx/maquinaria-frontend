import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import { t } from '../../../nucleo/i18n/i18n';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { SesionPlataformaStore } from '../../../nucleo/sesion/sesion-plataforma';
import { CampoContrasena } from '../../acceso/campo-contrasena';
import { MarcoAcceso } from '../../acceso/marco-acceso';

@Component({
  selector: 'app-iniciar-sesion-plataforma',
  imports: [CampoContrasena, ReactiveFormsModule, MarcoAcceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iniciar-sesion.html',
})
export class IniciarSesionPlataforma {
  readonly destino = input('');

  private readonly api = inject(ApiPlataforma);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  protected enviar(): void {
    if (this.enviando()) {
      return;
    }

    // Un formulario invalido no se ignora en silencio: se marca para que el
    // navegador muestre los campos en falta y se dice que pasa. Antes el clic
    // no producia ningun efecto visible.
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set(t().comun.faltanCredenciales);
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { correo, contrasena } = this.formulario.getRawValue();

    this.api.iniciarSesion(correo, contrasena).subscribe({
      next: (sesion) => {
        this.sesion.abrir(sesion);
        void this.router.navigateByUrl(this.destino() || '/');
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
