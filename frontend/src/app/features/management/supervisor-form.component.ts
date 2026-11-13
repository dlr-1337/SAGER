import {
  ERROR_CONFLICT,
  ERROR_FORBIDDEN,
  ERROR_GENERIC,
  ERROR_INVALID,
  ERROR_SESSION,
} from '../../core/error-messages';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { PASSWORD_HELP, PASSWORD_MISMATCH, passwordRules } from '../../shared/password-rules';
import {
  fieldRule,
  nameProblem,
  SUPERVISOR_EMAIL,
  supervisorIdProblem,
} from '../../shared/field-rules';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { ManagementDemoService } from './management-demo.service';
import { Supervisor } from './management.models';
import { SupervisorApiError, SupervisorApiService } from './supervisor-api.service';

@Component({
  selector: 'app-supervisor-form',
  standalone: true,
  imports: [UnsavedFormDirective, ReactiveFormsModule, RouterLink, PasswordFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>A gestão de supervisores está disponível só para o gestor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
            >progress_activity</span
          >
          <h1>Carregando supervisor</h1>
          <p>Aguarde um momento.</p>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{ missing() ? 'Supervisor não encontrado' : 'Não foi possível carregar o supervisor' }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (!missing()) {
            <button type="button" class="btn mg-primary" (click)="load()">Tentar novamente</button>
          }
          <a class="btn mg-secondary" routerLink="/supervisores">Voltar à equipe</a>
        </section>
      } @else if (editId && !supervisor()) {
        <section class="mg-empty" role="alert">
          <h1>Supervisor não encontrado</h1>
          <p>Não encontramos este cadastro. Volte à lista e tente de novo.</p>
          <a class="btn mg-primary" routerLink="/supervisores">Voltar à equipe</a>
        </section>
      } @else {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/supervisores"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Supervisores</a
            >
            <h1>{{ editId ? 'Editar supervisor' : 'Cadastrar supervisor' }}</h1>
            <p>Preencha os dados do supervisor.</p>
          </div>
        </header>
        <form
          sagerUnsaved
          [sagerSaving]="saving"
          class="panel mg-panel mg-form"
          [formGroup]="form"
          (ngSubmit)="save()"
          novalidate
        >
          <h2>Dados do supervisor</h2>
          <p class="mg-muted">
            Campos marcados com * são obrigatórios.
            @if (isDemo()) {
              Use somente dados fictícios nesta demonstração.
            }
          </p>
          <div class="form-grid mg-form-grid">
            <label class="field mg-field mg-span-2"
              >Nome completo *<input
                [attr.aria-invalid]="
                  form.controls.name.invalid && form.controls.name.touched ? 'true' : null
                "
                formControlName="name"
                autocomplete="off"
                maxlength="200"
                aria-describedby="supervisor-name-error"
              />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="mg-field-error" id="supervisor-name-error">{{
                  form.controls.name.errors?.['fieldRule']
                }}</span>
              }
            </label>
            <label class="field mg-field"
              >Matrícula ou SIAPE (usada para entrar) *<input
                [attr.aria-invalid]="
                  form.controls.institutionalId.invalid && form.controls.institutionalId.touched
                    ? 'true'
                    : null
                "
                formControlName="institutionalId"
                autocomplete="off"
                maxlength="64"
                aria-describedby="supervisor-id-error"
              />
              @if (form.controls.institutionalId.invalid && form.controls.institutionalId.touched) {
                <span class="mg-field-error" id="supervisor-id-error">{{
                  form.controls.institutionalId.errors?.['fieldRule']
                }}</span>
              }
            </label>
            <label class="field mg-field"
              >E-mail *<input
                [attr.aria-invalid]="
                  form.controls.email.invalid && form.controls.email.touched ? 'true' : null
                "
                type="email"
                formControlName="email"
                autocomplete="off"
                maxlength="320"
                aria-describedby="supervisor-email-hint supervisor-email-error"
              />
              <small class="field-hint" id="supervisor-email-hint"
                >Se tiver, use o institucional, que termina em &#64;ifgoiano.edu.br.</small
              >
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <span class="mg-field-error" id="supervisor-email-error"
                  >Informe um e-mail válido com até 320 caracteres.</span
                >
              }
            </label>
            @if (!editId) {
              <div class="mg-field">
                <label for="supervisor-password">Senha *</label>
                <sager-password-field>
                  <input
                    id="supervisor-password"
                    type="password"
                    formControlName="password"
                    [attr.aria-invalid]="
                      form.controls.password.invalid && form.controls.password.touched
                        ? 'true'
                        : null
                    "
                    aria-describedby="supervisor-password-help supervisor-password-error"
                    autocomplete="new-password"
                    required
                  />
                </sager-password-field>
                <small class="field-hint" id="supervisor-password-help">{{ passwordHelp }}</small>
                @if (form.controls.password.invalid && form.controls.password.touched) {
                  <span class="mg-field-error" id="supervisor-password-error">{{
                    form.controls.password.errors?.['passwordRules']
                  }}</span>
                }
              </div>
              <div class="mg-field">
                <label for="supervisor-password-confirmation">Confirmar senha *</label>
                <sager-password-field>
                  <input
                    id="supervisor-password-confirmation"
                    type="password"
                    formControlName="passwordConfirmation"
                    autocomplete="new-password"
                    required
                  />
                </sager-password-field>
              </div>
            }
          </div>
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              @if (editId) {
                Esta tela não muda a senha. Se trocar a matrícula ou SIAPE, a pessoa passa a entrar
                com o novo número.
              } @else if (isDemo()) {
                Fora da demonstração, a pessoa entra com a matrícula ou SIAPE e a senha informadas
                aqui. Nesta demonstração, a senha não é guardada.
              } @else {
                A pessoa entra no sistema com a matrícula ou SIAPE e a senha informadas aqui.
              }
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn mg-secondary" (click)="reloadLatest()">
              Recarregar dados
            </button>
          }
          <div class="action-row mg-actions">
            <a class="btn mg-secondary" routerLink="/supervisores">Cancelar</a
            ><button type="submit" class="btn mg-primary" [disabled]="saving()">
              <span class="material-symbols-rounded" aria-hidden="true">save</span>
              {{ saving() ? 'Salvando…' : 'Salvar supervisor' }}
            </button>
          </div>
        </form>
      }
    </main>
  `,
})
export class SupervisorFormComponent {
  private readonly demo = inject(ManagementDemoService);
  private readonly api = inject(SupervisorApiService);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly localSupervisor = signal<Supervisor | null>(null);
  readonly supervisor = computed(() =>
    this.isDemo()
      ? this.editId
        ? this.demo.supervisor(this.editId)
        : undefined
      : (this.localSupervisor() ?? undefined),
  );
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly saving = signal(false);
  readonly passwordHelp = PASSWORD_HELP;
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [fieldRule(nameProblem, () => this.supervisor()?.name)],
    }),
    institutionalId: new FormControl('', {
      nonNullable: true,
      validators: [fieldRule(supervisorIdProblem, () => this.supervisor()?.institutionalId)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.pattern(SUPERVISOR_EMAIL),
        Validators.maxLength(320),
      ],
    }),
    password: new FormControl('', { nonNullable: true }),
    passwordConfirmation: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    if (!this.editId) {
      this.form.controls.password.setValidators(passwordRules('institutionalId'));
      this.form.controls.passwordConfirmation.setValidators(Validators.required);
      this.form.controls.institutionalId.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.form.controls.password.updateValueAndValidity());
    }
    if (this.isDemo()) {
      const existing = this.supervisor();
      if (existing) this.setFields(existing);
    } else if (this.editId && this.canEdit()) {
      void this.load();
    }
  }

  async load(): Promise<void> {
    if (!this.editId || this.isDemo()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      const existing = await this.api.get(this.editId);
      this.localSupervisor.set(existing);
      this.setFields(existing);
    } catch (error) {
      this.localSupervisor.set(null);
      this.missing.set(error instanceof SupervisorApiError && error.status === 404);
      this.loadError.set(
        this.missing()
          ? 'Não encontramos este cadastro. Volte à lista e tente de novo.'
          : ERROR_GENERIC,
      );
    } finally {
      this.loading.set(false);
    }
  }

  async reloadLatest(): Promise<void> {
    this.conflict.set(false);
    this.error.set('');
    await this.load();
  }

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    this.error.set('');
    this.conflict.set(false);
    const input = {
      name: this.form.controls.name.value.trim(),
      institutionalId: this.form.controls.institutionalId.value.trim(),
      email: this.form.controls.email.value.trim().toLowerCase(),
    };
    this.form.patchValue(input, { emitEvent: false });
    const { password, passwordConfirmation } = this.form.getRawValue();
    const mismatch = !this.editId && password !== passwordConfirmation;
    if (mismatch) this.error.set(PASSWORD_MISMATCH);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (mismatch) return;
    if (this.isDemo()) {
      try {
        const saved = this.demo.saveSupervisor(input, this.editId ?? undefined);
        this.form.markAsPristine();
        await this.router.navigate(['/supervisores', saved.id], { queryParams: { saved: '1' } });
      } catch (error) {
        this.error.set(
          error instanceof Error ? error.message : 'Não foi possível salvar o supervisor.',
        );
      }
      return;
    }
    this.saving.set(true);
    try {
      const existing = this.localSupervisor();
      const saved = await this.api.save(
        this.editId ? input : { ...input, password, passwordConfirmation },
        this.editId && existing ? { id: existing.id, version: existing.version } : undefined,
      );
      this.saving.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/supervisores', saved.id], { queryParams: { saved: '1' } });
    } catch (error) {
      if (error instanceof SupervisorApiError && error.status === 409) {
        const stale = this.editId && error.code === 'stale_version';
        this.conflict.set(!!stale);
        this.error.set(
          stale
            ? ERROR_CONFLICT
            : 'Já existe um cadastro ou uma conta com esta matrícula ou SIAPE. Confira os dados.',
        );
      } else if (error instanceof SupervisorApiError && error.status === 400) {
        this.error.set(ERROR_INVALID);
      } else if (error instanceof SupervisorApiError && error.status === 401) {
        this.error.set(ERROR_SESSION);
      } else if (error instanceof SupervisorApiError && error.status === 403) {
        this.error.set(ERROR_FORBIDDEN);
      } else {
        this.error.set(ERROR_GENERIC);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private setFields(item: Supervisor): void {
    this.form.patchValue({
      name: item.name,
      institutionalId: item.institutionalId,
      email: item.email,
    });
  }
}
