import { UnsavedFormDirective, UnsavedForms } from '../../shared/unsaved-form';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { AccommodationApiError, accommodationErrorMessage } from './accommodation-api.service';
import { AccommodationDataService } from './accommodation-data.service';
import { Accommodation, AccommodationUnit } from './housing.models';

@Component({
  selector: 'app-accommodation-detail',
  styleUrl: './housing.scss',
  standalone: true,
  imports: [UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page mg-page mg-narrow">
      @if (loading()) {
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
      } @else if (item(); as accommodation) {
        <header class="mg-heading">
          <div>
            <a class="mg-back" routerLink="/alojamentos"
              ><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
              Alojamentos</a
            >
            <h1>{{ accommodation.name }}</h1>
            <p>Código {{ accommodation.code }}</p>
          </div>
          @if (canEdit()) {
            <a class="btn mg-primary" [routerLink]="['/alojamentos', accommodation.id, 'editar']"
              ><span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
              alojamento</a
            >
          }
        </header>
        @if (saved()) {
          <p class="mg-success" role="status">
            <span class="material-symbols-rounded" aria-hidden="true">check_circle</span
            >{{
              isDemo()
                ? 'Alojamento salvo nesta demonstração.'
                : 'Alojamento salvo no ambiente local de teste.'
            }}
          </p>
        }
        <section class="mg-section" aria-labelledby="unit-list-title">
          <div class="mg-section-heading">
            <h2 id="unit-list-title">Casas e blocos</h2>
            @if (canEdit() && !unitOpen()) {
              <button type="button" class="btn mg-secondary" (click)="newUnit()">
                <span class="material-symbols-rounded" aria-hidden="true">add</span> Adicionar casa
                ou bloco
              </button>
            }
          </div>
          <p class="mg-muted">
            Use este agrupamento quando o alojamento tiver casas ou blocos internos. Quartos também
            podem pertencer diretamente ao alojamento.
          </p>
          @if (unitSuccess()) {
            <p class="mg-success" role="status">{{ unitSuccess() }}</p>
          }
          @if (units().length) {
            <div class="mg-list">
              @for (unit of units(); track unit.id) {
                <article class="mg-row">
                  <div class="mg-row-main">
                    <h3>{{ unit.name }}</h3>
                    <p>Código {{ unit.code }}</p>
                  </div>
                  @if (canEdit()) {
                    <button
                      type="button"
                      class="btn mg-secondary"
                      (click)="editUnit(unit)"
                      [disabled]="unitSaving()"
                      [attr.aria-label]="'Editar ' + unit.name"
                    >
                      <span class="material-symbols-rounded" aria-hidden="true">edit</span> Editar
                    </button>
                  }
                </article>
              }
            </div>
          } @else {
            <p>Nenhuma casa ou bloco cadastrado neste alojamento.</p>
          }
          @if (unitOpen()) {
            <form
              sagerUnsaved
              [sagerSaving]="unitSaving"
              class="panel mg-panel mg-form"
              [formGroup]="unitForm"
              (ngSubmit)="saveUnit()"
              novalidate
            >
              <h3>{{ editingUnit() ? 'Editar casa ou bloco' : 'Adicionar casa ou bloco' }}</h3>
              <p class="mg-muted">Campos marcados com * são obrigatórios.</p>
              <div class="mg-form-grid">
                <label class="field mg-field"
                  >Código da casa ou bloco *<input
                    formControlName="code"
                    maxlength="64"
                    autocomplete="off"
                    [attr.aria-invalid]="
                      unitForm.controls.code.touched && unitForm.controls.code.invalid
                    "
                  />
                  @if (unitForm.controls.code.touched && unitForm.controls.code.invalid) {
                    <span class="mg-field-error">Informe um código de até 64 caracteres.</span>
                  }</label
                ><label class="field mg-field"
                  >Nome da casa ou bloco *<input
                    formControlName="name"
                    maxlength="200"
                    autocomplete="off"
                    [attr.aria-invalid]="
                      unitForm.controls.name.touched && unitForm.controls.name.invalid
                    "
                  />
                  @if (unitForm.controls.name.touched && unitForm.controls.name.invalid) {
                    <span class="mg-field-error">Informe um nome de até 200 caracteres.</span>
                  }
                </label>
              </div>
              @if (unitError()) {
                <p class="mg-alert" role="alert">{{ unitError() }}</p>
              }
              @if (unitConflict()) {
                <button
                  type="button"
                  class="btn mg-secondary"
                  (click)="reloadUnit()"
                  [disabled]="unitSaving()"
                >
                  Carregar versão atual da unidade
                </button>
              }
              <div class="mg-actions">
                <button
                  type="button"
                  class="btn mg-secondary"
                  (click)="cancelUnit()"
                  [disabled]="unitSaving()"
                >
                  Cancelar</button
                ><button type="submit" class="btn mg-primary" [disabled]="unitSaving()">
                  <span class="material-symbols-rounded" aria-hidden="true">save</span
                  >{{ unitSaving() ? 'Salvando unidade…' : 'Salvar casa ou bloco' }}
                </button>
              </div>
            </form>
          }
        </section>
        <div class="mg-note">
          <span class="material-symbols-rounded" aria-hidden="true">info</span>
          <p>
            {{
              isDemo()
                ? 'Dados fictícios da demonstração, mantidos somente em memória.'
                : 'Ambiente local de teste: use apenas dados fictícios.'
            }}
            A capacidade é cadastrada por quarto. A ocupação ainda não está integrada.
          </p>
        </div>
        <a class="mg-back" routerLink="/quartos"
          >Ir ao mapa de quartos
          <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a
        >
      }
    </main>
  `,
})
export class AccommodationDetailComponent {
  private readonly drafts = inject(UnsavedForms);
  private readonly data = inject(AccommodationDataService);
  private readonly session = inject(DemoSessionService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly item = signal<Accommodation | null>(null);
  readonly units = signal<AccommodationUnit[]>([]);
  readonly canEdit = computed(() => this.session.hasRole('gestor', 'supervisor'));
  readonly isDemo = this.session.active;
  readonly saved = signal(this.route.snapshot.queryParamMap.get('saved') === '1');
  readonly loading = signal(false);
  readonly missing = signal(false);
  readonly loadError = signal('');
  readonly unitOpen = signal(false);
  readonly editingUnit = signal<AccommodationUnit | null>(null);
  readonly unitSaving = signal(false);
  readonly unitConflict = signal(false);
  readonly unitError = signal('');
  readonly unitSuccess = signal('');
  readonly unitForm = new FormGroup({
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
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    this.missing.set(false);
    try {
      const [item, units] = await Promise.all([
        this.data.get(this.id),
        this.data.listUnits(this.id),
      ]);
      this.item.set(item);
      this.units.set(units);
    } catch (error) {
      this.item.set(null);
      this.units.set([]);
      this.missing.set(error instanceof AccommodationApiError && error.status === 404);
      this.loadError.set(accommodationErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  newUnit(): void {
    if (!this.canEdit()) return;
    this.editingUnit.set(null);
    this.unitForm.reset({ code: '', name: '' });
    this.unitOpen.set(true);
    this.unitError.set('');
    this.unitConflict.set(false);
    this.unitSuccess.set('');
  }
  editUnit(unit: AccommodationUnit): void {
    if (!this.canEdit()) return;
    this.editingUnit.set(unit);
    this.unitForm.reset({ code: unit.code, name: unit.name });
    this.unitOpen.set(true);
    this.unitError.set('');
    this.unitConflict.set(false);
    this.unitSuccess.set('');
  }
  async cancelUnit(): Promise<void> {
    if (!(await this.drafts.canLeave())) return;
    this.unitOpen.set(false);
    this.unitError.set('');
    this.unitConflict.set(false);
  }
  async reloadUnit(): Promise<void> {
    const unit = this.editingUnit();
    if (!unit || this.unitSaving()) return;
    this.unitSaving.set(true);
    try {
      this.editUnit(await this.data.getUnit(this.id, unit.id));
    } catch (error) {
      this.unitError.set(accommodationErrorMessage(error));
    } finally {
      this.unitSaving.set(false);
    }
  }
  async saveUnit(): Promise<void> {
    if (!this.canEdit() || this.unitSaving()) return;
    const input = {
      code: this.unitForm.controls.code.value.trim(),
      name: this.unitForm.controls.name.value.trim(),
    };
    this.unitForm.patchValue(input, { emitEvent: false });
    this.unitError.set('');
    this.unitConflict.set(false);
    if (this.unitForm.invalid) {
      this.unitForm.markAllAsTouched();
      return;
    }
    this.unitSaving.set(true);
    try {
      const unit = await this.data.saveUnit(this.id, input, this.editingUnit() ?? undefined);
      this.units.update((items) => [...items.filter((entry) => entry.id !== unit.id), unit]);
      this.unitForm.markAsPristine();
      this.unitOpen.set(false);
      this.unitSuccess.set(
        this.isDemo()
          ? 'Unidade salva nesta demonstração.'
          : 'Unidade salva no ambiente local de teste.',
      );
    } catch (error) {
      this.unitConflict.set(
        error instanceof AccommodationApiError && error.code === 'stale_version',
      );
      this.unitError.set(accommodationErrorMessage(error));
    } finally {
      this.unitSaving.set(false);
    }
  }
}
