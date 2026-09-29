import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { AccommodationApiError, accommodationErrorMessage } from './accommodation-api.service';
import { AccommodationDataService } from './accommodation-data.service';
import { Accommodation } from './housing.models';

@Component({
  selector: 'app-accommodation-form',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (!canEdit()) {
        <section class="mg-empty" role="alert">
          <h1>Acesso restrito</h1>
          <p>Somente o gestor pode editar alojamentos.</p>
          <a class="btn mg-primary" routerLink="/alojamentos">Voltar aos alojamentos</a>
        </section>
      } @else if (loading()) {
        <section class="mg-empty" role="status" aria-live="polite">
          <h1>Carregando alojamento</h1>
        </section>
      } @else if (loadError()) {
        <section class="mg-empty" role="alert">
          <h1>
            {{ missing() ? 'Alojamento não encontrado' : 'Não foi possível carregar o alojamento' }}
          </h1>
          <p>{{ loadError() }}</p>
          @if (!missing()) {
            <button class="btn mg-primary" type="button" (click)="load()">Tentar novamente</button>
          }
          <a class="mg-back" routerLink="/alojamentos">Voltar aos alojamentos</a>
        </section>
      } @else {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/alojamentos"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Alojamentos</a
            >
            <h1>{{ editId ? 'Editar alojamento' : 'Cadastrar alojamento' }}</h1>
            <p>Informe a identificação da residência ou conjunto de casas.</p>
          </div>
        </header>
        <form class="panel mg-panel mg-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2>Dados do alojamento</h2>
          <p class="mg-muted">Campos marcados com * são obrigatórios.</p>
          <div class="mg-form-grid">
            <label class="field mg-field"
              >Código do alojamento *<input
                formControlName="code"
                maxlength="64"
                autocomplete="off"
                [attr.aria-invalid]="form.controls.code.touched && form.controls.code.invalid"
                aria-describedby="accommodation-code-help"
              /><span id="accommodation-code-help" class="mg-muted"
                >Identificação única. Exemplo fictício: TESTE-A.</span
              >
              @if (form.controls.code.touched && form.controls.code.invalid) {
                <span class="mg-field-error">Informe um código de até 64 caracteres.</span>
              }
            </label>
            <label class="field mg-field"
              >Nome do alojamento *<input
                formControlName="name"
                maxlength="200"
                autocomplete="off"
                [attr.aria-invalid]="form.controls.name.touched && form.controls.name.invalid"
              />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <span class="mg-field-error">Informe um nome de até 200 caracteres.</span>
              }
            </label>
          </div>
          <div class="mg-note">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            <p>
              Casas e blocos são opcionais e podem ser adicionados depois. A capacidade será
              informada em cada quarto.
            </p>
          </div>
          @if (error()) {
            <p class="mg-alert" role="alert">{{ error() }}</p>
          }
          @if (conflict()) {
            <button
              class="btn mg-secondary"
              type="button"
              (click)="reloadLatest()"
              [disabled]="saving()"
            >
              Carregar versão atual do alojamento
            </button>
          }
          <div class="mg-actions">
            <a
              class="btn mg-secondary"
              [routerLink]="editId ? ['/alojamentos', editId] : ['/alojamentos']"
              >Cancelar</a
            ><button class="btn mg-primary" type="submit" [disabled]="saving()">
              <span class="material-symbols-rounded" aria-hidden="true">save</span
              >{{ saving() ? 'Salvando alojamento…' : 'Salvar alojamento' }}
            </button>
          </div>
        </form>
      }
    </main>
  `,
})
export class AccommodationFormComponent {
  private readonly data = inject(AccommodationDataService);
  private readonly session = inject(DemoSessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly editId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly canEdit = computed(() => this.session.hasRole('gestor'));
  readonly existing = signal<Accommodation | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly missing = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
  });
  constructor() {
    if (this.editId && this.canEdit()) void this.load();
  }
  async load(): Promise<void> {
    if (!this.editId) return;
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      const item = await this.data.get(this.editId);
      this.existing.set(item);
      this.form.setValue({ code: item.code, name: item.name });
    } catch (error) {
      this.existing.set(null);
      this.missing.set(error instanceof AccommodationApiError && error.status === 404);
      this.loadError.set(accommodationErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  async reloadLatest(): Promise<void> {
    if (!this.editId || this.saving()) return;
    this.saving.set(true);
    try {
      const item = await this.data.get(this.editId);
      this.existing.set(item);
      this.form.setValue({ code: item.code, name: item.name });
      this.error.set('');
      this.conflict.set(false);
    } catch (error) {
      this.error.set(accommodationErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    const input = {
      code: this.form.controls.code.value.trim(),
      name: this.form.controls.name.value.trim(),
    };
    this.form.patchValue(input, { emitEvent: false });
    this.error.set('');
    this.conflict.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const item = await this.data.save(input, this.existing() ?? undefined);
      if (!this.destroyRef.destroyed) {
        await this.router.navigate(['/alojamentos', item.id], { queryParams: { saved: '1' } });
      }
    } catch (error) {
      this.conflict.set(error instanceof AccommodationApiError && error.code === 'stale_version');
      this.error.set(accommodationErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
