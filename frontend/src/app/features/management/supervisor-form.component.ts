import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';

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
          <p>A gestão de supervisores está disponível apenas ao gestor.</p>
          <a class="btn mg-primary" routerLink="/inicio">Voltar ao início</a>
        </section>
      } @else if (editId && !supervisor()) {
        <section class="mg-empty" role="alert">
          <h1>Supervisor não encontrado</h1>
          <p>O cadastro solicitado não está disponível nesta demonstração.</p>
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
        @if (saved()) {
          <p class="mg-success" role="status">Supervisor salvo nesta demonstração.</p>
        }
        <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2>Dados funcionais</h2>
          <p class="mg-muted">Campos marcados com * são obrigatórios.</p>
          <div class="form-grid mg-form-grid">
            <label class="field mg-field mg-span-2"
              >Nome completo *<input formControlName="name" autocomplete="name" />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="mg-field-error">Informe o nome com pelo menos 3 caracteres.</span>
              }
            </label>
            <label class="field mg-field"
              >Identificação institucional *<input
                formControlName="institutionalId"
                autocomplete="off"
              />
              @if (form.controls.institutionalId.invalid && form.controls.institutionalId.touched) {
                <span class="mg-field-error">Informe a identificação institucional.</span>
              }
            </label>
            <label class="field mg-field"
              >E-mail institucional *<input
                type="email"
                formControlName="email"
                autocomplete="email"
              />
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <span class="mg-field-error">Informe um e-mail válido.</span>
              }
            </label>
          </div>
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              Este cadastro não concede acesso ao sistema. A criação de credenciais dependerá da
              integração institucional da TI.
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          <div class="action-row mg-actions">
            <a class="btn mg-secondary" routerLink="/supervisores">Cancelar</a
            ><button type="submit" class="btn mg-primary">
              <span class="material-symbols-rounded" aria-hidden="true">save</span> Salvar
              supervisor
            </button>
          </div>
        </form>
      }
    </main>
  `,
})
export class SupervisorFormComponent {
  private readonly service = inject(ManagementDemoService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly editId = this.route.snapshot.paramMap.get('id');
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly supervisor = computed(() =>
    this.editId ? this.service.supervisor(this.editId) : undefined,
  );
  readonly error = signal('');
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    institutionalId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  constructor() {
    const existing = this.supervisor();
    if (existing)
      this.form.setValue({
        name: existing.name,
        institutionalId: existing.institutionalId,
        email: existing.email,
      });
  }

  save(): void {
    if (!this.canEdit()) return;
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const supervisor = this.service.saveSupervisor(
        this.form.getRawValue(),
        this.editId ?? undefined,
      );
      void this.router.navigate(['/supervisores', supervisor.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o supervisor. Tente novamente.',
      );
    }
  }
}
