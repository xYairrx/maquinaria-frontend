import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FORMATO_SLUG, urlDeEmpresa } from '../../../nucleo/ambiente/tenant';
import { MarcoAcceso } from '../../acceso/marco-acceso';

/**
 * La puerta de entrada: `login.<dominio>` y el dominio pelado.
 *
 * Solo pregunta a qué empresa se entra y manda a su subdominio. NO valida credenciales
 * y NO consulta a la API.
 *
 * POR QUÉ NO PIDE AQUÍ EL CORREO Y LA CONTRASEÑA: cada empresa tiene su propia base de
 * datos, así que no existe un lugar donde estén todos los correos. Averiguar la empresa
 * a partir del correo exigiría un índice `correo → empresa` en la base central, y eso
 * duplicaría correos fuera de su base, rompería la instalación on-premise y permitiría
 * enumerar clientes escribiendo correos. Hay que saber la empresa ANTES de validar nada.
 *
 * TAMPOCO comprueba que la empresa exista, y es a propósito: decir «esa empresa no
 * existe» delata cuáles sí, que es justo lo que evitan las reglas anti-enumeración del
 * login. Un slug inventado lleva a una pantalla de acceso que fallará igual que
 * cualquier credencial incorrecta.
 */
@Component({
  selector: 'app-seleccionar-empresa',
  imports: [ReactiveFormsModule, MarcoAcceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seleccionar-empresa.html',
})
export class SeleccionarEmpresa {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly invalido = signal(false);

  protected readonly formulario = this.fb.group({
    empresa: ['', [Validators.required, Validators.pattern(FORMATO_SLUG)]],
  });

  protected continuar(): void {
    const empresa = this.formulario.controls.empresa.value.trim().toLowerCase();

    if (!FORMATO_SLUG.test(empresa)) {
      this.invalido.set(true);
      return;
    }

    this.invalido.set(false);

    // Cambio de origen: no es una navegación del router, es otra aplicación.
    window.location.assign(urlDeEmpresa(empresa));
  }
}
