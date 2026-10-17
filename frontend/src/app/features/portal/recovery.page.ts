import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalAuthService } from '../../core/local-auth.service';

@Component({
  standalone: true,
  imports: [UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  template: `
    <main class="page mg-page mg-narrow">
      <h1>Recuperar senha</h1>
      <p>
        Informe os dados do seu cadastro de residente. Nenhuma mensagem será enviada por e-mail ou
        telefone.
      </p>
      <p>
        Servidores e cadastros antigos sem data de nascimento ou conta vinculada devem procurar a
        equipe responsável.
      </p>
      @if (done()) {
        <section class="panel mg-panel" role="status">
          <h2>Senha redefinida</h2>
          <p>As sessões anteriores foram encerradas. Entre com sua matrícula e a nova senha.</p>
          <a class="btn" routerLink="/acesso">Voltar ao acesso</a>
        </section>
      } @else {
        <form
          sagerUnsaved
          [sagerSaving]="busy"
          class="panel mg-panel mg-form"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          <label class="mg-field"
            >Matrícula<input
              formControlName="matricula"
              autocomplete="username"
              maxlength="64"
              required
          /></label>
          <label class="mg-field"
            >Nome completo<input
              formControlName="name"
              autocomplete="name"
              maxlength="200"
              required
          /></label>
          <label class="mg-field"
            >Data de nascimento<input
              type="date"
              formControlName="birthDate"
              autocomplete="bday"
              required
          /></label>
          <label class="mg-field"
            >Nome completo do responsável ativo<input
              formControlName="guardianName"
              maxlength="200"
              aria-describedby="guardian-hint"
            /><small id="guardian-hint"
              >Preencha se houver um responsável ativo vinculado ao seu cadastro.</small
            ></label
          >
          <label class="mg-field"
            >Nova senha<input
              type="password"
              formControlName="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="72"
              required
            /><small
              >Use de 12 a 72 caracteres (até 72 bytes). Não use informações pessoais.</small
            ></label
          >
          <label class="mg-field"
            >Confirmar nova senha<input
              type="password"
              formControlName="passwordConfirmation"
              autocomplete="new-password"
              required
          /></label>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          <div class="action-row">
            <a class="btn mg-secondary" routerLink="/acesso">Cancelar</a
            ><button class="btn" [disabled]="busy()">
              {{ busy() ? 'Verificando…' : 'Redefinir senha' }}
            </button>
          </div>
        </form>
      }
    </main>
  `,
})
export class RecoveryPage {
  private readonly auth = inject(LocalAuthService);
  readonly done = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    matricula: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    birthDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    guardianName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(72)],
    }),
    passwordConfirmation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    const input = this.form.getRawValue();
    if (
      this.form.invalid ||
      input.password !== input.passwordConfirmation ||
      new TextEncoder().encode(input.password).length > 72
    ) {
      this.form.markAllAsTouched();
      this.error.set(
        'Confira os campos e repita a mesma senha, com 12 a 72 caracteres e até 72 bytes.',
      );
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.recover(input);
      this.form.reset();
      this.done.set(true);
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
