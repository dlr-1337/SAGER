import { Component, ElementRef, contentChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControlName, FormGroupDirective } from '@angular/forms';

/** Envolve o `<input type="password" formControlName>` e acrescenta o botão de mostrar e ocultar.
 *  Fique fora do `<label>` e use `for`/`id`: dentro dele, o nome do botão entraria no nome do campo. */
@Component({
  selector: 'sager-password-field',
  standalone: true,
  template: `
    <ng-content />
    <button
      type="button"
      class="password-toggle"
      [attr.aria-label]="visible() ? 'Ocultar senha' : 'Mostrar senha'"
      (click)="show(!visible())"
    >
      <span class="material-symbols-rounded" aria-hidden="true">{{
        visible() ? 'visibility_off' : 'visibility'
      }}</span
      >{{ visible() ? 'Ocultar' : 'Mostrar' }}
    </button>
  `,
})
export class PasswordFieldComponent {
  private readonly input = contentChild.required(FormControlName, { read: ElementRef });
  readonly visible = signal(false);

  constructor() {
    inject(FormGroupDirective)
      .ngSubmit.pipe(takeUntilDestroyed())
      .subscribe(() => this.show(false));
  }

  show(visible: boolean): void {
    const input: HTMLInputElement = this.input().nativeElement;
    this.visible.set(visible);
    input.type = visible ? 'text' : 'password';
    // Como texto, o teclado do celular mudaria a senha e o corretor poderia enviá-la para fora.
    input.autocapitalize = 'none';
    input.spellcheck = false;
  }
}
