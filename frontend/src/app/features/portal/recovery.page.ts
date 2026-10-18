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
      <p class="lead">
        Informe os dados do seu cadastro de residente. Nenhuma mensagem será enviada por e-mail ou
        telefone.
      </p>
      <p>
        Cadastros antigos sem data de nascimento ou conta vinculada devem procurar a equipe
        responsável.
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
          class="mg-form"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          <fieldset>
            <legend>1. Confirme seus dados</legend>
            <label class="mg-field"
              >Matrícula<input
                formControlName="matricula"
                [attr.aria-invalid]="invalid('matricula')"
                [attr.aria-describedby]="invalid('matricula') ? 'recovery-error' : null"
                autocomplete="username"
                maxlength="64"
                required
            /></label>
            <label class="mg-field"
              >Nome completo<input
                formControlName="name"
                [attr.aria-invalid]="invalid('name')"
                [attr.aria-describedby]="invalid('name') ? 'recovery-error' : null"
                autocomplete="name"
                maxlength="200"
                required
            /></label>
            <label class="mg-field"
              >Data de nascimento<input
                type="date"
                formControlName="birthDate"
                [attr.aria-invalid]="invalid('birthDate')"
                [attr.aria-describedby]="invalid('birthDate') ? 'recovery-error' : null"
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
          </fieldset>
          <fieldset>
            <legend>2. Crie a nova senha</legend>
            <label class="mg-field"
              >Nova senha<input
                type="password"
                formControlName="password"
                [attr.aria-invalid]="invalid('password')"
                [attr.aria-describedby]="invalid('password') ? 'recovery-error' : null"
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
                [attr.aria-invalid]="invalid('passwordConfirmation')"
                [attr.aria-describedby]="invalid('passwordConfirmation') ? 'recovery-error' : null"
                autocomplete="new-password"
                required
            /></label>
          </fieldset>
          @if (error()) {
            <p class="mg-alert" id="recovery-error" role="alert">{{ error() }}</p>
          }
          <div class="action-row">
            <a class="btn mg-secondary" routerLink="/acesso">Cancelar</a
            ><button class="btn" [disabled]="busy()">
              {{ busy() ? 'Verificando…' : 'Redefinir senha' }}
            </button>
          </div>
        </form>
      }
      <div class="mg-note">
        <span class="material-symbols-rounded" aria-hidden="true">info</span>
        <div>
          <strong>Gestores, supervisores e profissionais de saúde</strong>
          <p>
            Procure o suporte da instituição. Um operador autorizado confere sua identidade e
            redefine a senha.
          </p>
        </div>
      </div>
    </main>
  `,
  styles: `
    fieldset {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: 20px;
      min-width: 0;
      margin: 0 0 24px;
      padding: 20px 24px 24px;
      border: 1px solid var(--line);
      border-radius: var(--radius-card);
      background: #fff;
    }
    legend {
      padding: 0 8px;
      font-size: 1.1rem;
      font-weight: 800;
    }
    small {
      font-size: var(--text-meta);
      font-weight: 400;
      color: var(--muted);
    }
    .mg-note p {
      margin-top: 4px;
    }
    @media (max-width: 640px) {
      fieldset {
        padding: 16px 18px 18px;
      }
    }
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
  /** Marca o campo depois da primeira tentativa; a confirmação também falha se divergir. */
  invalid(name: keyof RecoveryPage['form']['controls']): 'true' | null {
    const control = this.form.controls[name];
    const mismatch =
      name === 'passwordConfirmation' && control.value !== this.form.controls.password.value;
    return control.touched && (control.invalid || mismatch) ? 'true' : null;
  }
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
