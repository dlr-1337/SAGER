import { readableError } from '../../core/error-messages';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { PASSWORD_HELP, PASSWORD_MISMATCH, passwordRules } from '../../shared/password-rules';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalAuthService } from '../../core/local-auth.service';

@Component({
  standalone: true,
  imports: [UnsavedFormDirective, ReactiveFormsModule, RouterLink, PasswordFieldComponent],
  template: `
    <main class="page mg-page mg-narrow">
      <h1>Recuperar senha</h1>
      <p class="lead">Confirme seus dados e crie uma senha nova.</p>
      @if (done()) {
        <section class="panel mg-panel" role="status">
          <h2>Senha trocada</h2>
          <p>Entre com sua matrícula e a senha nova.</p>
          <a class="btn" routerLink="/acesso">Entrar</a>
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
              >Nome completo do seu responsável (se tiver)<input
                formControlName="guardianName"
                maxlength="200"
            /></label>
          </fieldset>
          <fieldset>
            <legend>2. Crie a nova senha</legend>
            <div class="mg-field">
              <label for="recovery-password">Nova senha</label>
              <sager-password-field>
                <input
                  id="recovery-password"
                  type="password"
                  formControlName="password"
                  [attr.aria-invalid]="invalid('password')"
                  [attr.aria-describedby]="
                    invalid('password')
                      ? 'recovery-password-help recovery-error'
                      : 'recovery-password-help'
                  "
                  autocomplete="new-password"
                  required
                />
              </sager-password-field>
              <small id="recovery-password-help">{{ passwordHelp }}</small>
            </div>
            <div class="mg-field">
              <label for="recovery-confirmation">Confirmar nova senha</label>
              <sager-password-field>
                <input
                  id="recovery-confirmation"
                  type="password"
                  formControlName="passwordConfirmation"
                  [attr.aria-invalid]="invalid('passwordConfirmation')"
                  [attr.aria-describedby]="
                    invalid('passwordConfirmation') ? 'recovery-error' : null
                  "
                  autocomplete="new-password"
                  required
                />
              </sager-password-field>
            </div>
          </fieldset>
          @if (error()) {
            <p class="mg-alert" id="recovery-error" role="alert">{{ error() }}</p>
          }
          <div class="action-row">
            <a class="btn mg-secondary" routerLink="/acesso">Cancelar</a
            ><button class="btn" [disabled]="busy()">
              {{ busy() ? 'Verificando…' : 'Trocar senha' }}
            </button>
          </div>
        </form>
      }
      <div class="mg-note">
        <span class="material-symbols-rounded" aria-hidden="true">info</span>
        <div>
          <strong>Gestores, supervisores e profissionais de saúde</strong>
          <p>
            Procure o suporte da instituição. Alguém da equipe confere quem você é e troca sua
            senha.
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
  readonly passwordHelp = PASSWORD_HELP;
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
      validators: [passwordRules('matricula')],
    }),
    passwordConfirmation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  constructor() {
    this.form.controls.matricula.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.password.updateValueAndValidity());
  }
  /** Marca o campo só enquanto a mensagem de erro existe, para o aria-describedby apontar para
   *  ela; a confirmação também falha se divergir. */
  invalid(name: keyof RecoveryPage['form']['controls']): 'true' | null {
    const control = this.form.controls[name];
    const mismatch =
      name === 'passwordConfirmation' && control.value !== this.form.controls.password.value;
    return this.error() && (control.invalid || mismatch) ? 'true' : null;
  }
  async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    const input = this.form.getRawValue();
    const { password, passwordConfirmation, ...identity } = this.form.controls;
    const mismatch = input.password !== input.passwordConfirmation;
    if (this.form.invalid || mismatch) {
      this.form.markAllAsTouched();
      this.error.set(
        [
          Object.values(identity).some((control) => control.invalid)
            ? 'Confira os campos marcados.'
            : '',
          password.errors?.['passwordRules'],
          mismatch ? PASSWORD_MISMATCH : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.recover(input);
      this.form.reset();
      this.done.set(true);
    } catch (error) {
      this.error.set(readableError(error) + ' Não deu certo? Procure a equipe da residência.');
    } finally {
      this.busy.set(false);
    }
  }
}
