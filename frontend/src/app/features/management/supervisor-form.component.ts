import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { Supervisor } from './management.models';
import { SupervisorApiError, SupervisorApiService } from './supervisor-api.service';

@Component({
  selector: 'app-supervisor-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>A gestão de supervisores está disponível para gestor e supervisor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <span class="material-symbols-rounded mg-loading-icon" aria-hidden="true"
            >progress_activity</span
          >
          <h1>Carregando supervisor</h1>
          <p>Consultando o cadastro local de teste.</p>
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
          <p>
            O cadastro solicitado não está disponível
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
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
            <p>Informe os dados funcionais usados na gestão da residência.</p>
          </div>
        </header>
        <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2>Dados funcionais</h2>
          <p class="mg-muted">
            Campos marcados com * são obrigatórios. Use somente dados fictícios
            {{ isDemo() ? 'nesta demonstração' : 'no ambiente local de teste' }}.
          </p>
          <div class="form-grid mg-form-grid">
            <label
              class="field mg-field mg-span-2"
              [class.mg-invalid]="form.controls.name.invalid && form.controls.name.touched"
              >Nome completo *<input
                formControlName="name"
                autocomplete="name"
                maxlength="200"
                aria-describedby="supervisor-name-error"
              />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="mg-field-error" id="supervisor-name-error"
                  >Informe um nome de 3 a 200 caracteres.</span
                >
              }
            </label>
            <label
              class="field mg-field"
              [class.mg-invalid]="
                form.controls.institutionalId.invalid && form.controls.institutionalId.touched
              "
              >Identificação institucional *<input
                formControlName="institutionalId"
                autocomplete="off"
                maxlength="64"
                aria-describedby="supervisor-id-error"
              />
              @if (form.controls.institutionalId.invalid && form.controls.institutionalId.touched) {
                <span class="mg-field-error" id="supervisor-id-error"
                  >Informe a identificação institucional com até 64 caracteres.</span
                >
              }
            </label>
            <label
              class="field mg-field"
              [class.mg-invalid]="form.controls.email.invalid && form.controls.email.touched"
              >E-mail institucional *<input
                type="email"
                formControlName="email"
                autocomplete="email"
                maxlength="320"
                aria-describedby="supervisor-email-error"
              />
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <span class="mg-field-error" id="supervisor-email-error"
                  >Informe um e-mail válido com até 320 caracteres.</span
                >
              }
            </label>
          </div>
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              Este cadastro não concede acesso ao sistema e não cria senha. As credenciais locais de
              teste são geridas separadamente.
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          @if (conflict()) {
            <button type="button" class="btn mg-secondary" (click)="reloadLatest()">
              Carregar versão atual do cadastro
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
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly isDemo = this.session.active;
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
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
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    institutionalId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
  });

  constructor() {
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
          ? 'O cadastro solicitado não está disponível no ambiente local de teste.'
          : 'Confira a conexão com o backend local e tente novamente.',
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isDemo()) {
      try {
        const saved = this.demo.saveSupervisor(input, this.editId ?? undefined);
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
        input,
        this.editId && existing ? { id: existing.id, version: existing.version } : undefined,
      );
      await this.router.navigate(['/supervisores', saved.id], { queryParams: { saved: '1' } });
    } catch (error) {
      if (error instanceof SupervisorApiError && error.status === 409) {
        const stale = this.editId && error.code === 'stale_version';
        this.conflict.set(!!stale);
        this.error.set(
          stale
            ? 'Este cadastro foi alterado por outra sessão. Carregue a versão atual antes de salvar novamente.'
            : 'Já existe um cadastro com esta identificação institucional. Confira os dados.',
        );
      } else if (error instanceof SupervisorApiError && error.status === 400) {
        this.error.set('Os dados foram recusados. Confira os campos e tente novamente.');
      } else if (error instanceof SupervisorApiError && error.status === 401) {
        this.error.set('A sessão expirou. Entre novamente para salvar.');
      } else if (error instanceof SupervisorApiError && error.status === 403) {
        this.error.set('Seu perfil não tem permissão para salvar este cadastro.');
      } else {
        this.error.set(
          'Não foi possível salvar. Confira a conexão com o backend local e tente novamente.',
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private setFields(item: Supervisor): void {
    this.form.setValue({
      name: item.name,
      institutionalId: item.institutionalId,
      email: item.email,
    });
  }
}
