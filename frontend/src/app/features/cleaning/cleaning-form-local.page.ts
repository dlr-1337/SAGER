import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { CommunicationsStateComponent } from '../communications/communications-local.shared';
import {
  CommunicationIntent,
  formatCommunicationTime,
} from '../communications/communications-local.utils';
import { RoomApiService } from '../management/room-api.service';
import {
  AccommodationUnit,
  HousingMap,
  RoomRecord,
  cascadeLocation,
  roomOptionLabel,
  roomsIn,
  unitOptionLabel,
  unitsIn,
} from '../management/housing.models';
import {
  CleaningCriteriaFieldsComponent,
  criteriaForm,
  criteriaInput,
} from './cleaning-criteria-fields.component';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import { CleaningAssessment, CleaningInput, CleaningPolicy } from './cleaning-local.models';
import {
  cleaningInputError,
  cleaningPlan,
  criterionLabels,
  criteriaKeys,
  decimal,
  previewCleaningScore,
  retroactiveError,
} from './cleaning-local.utils';
import { ReportingApiError, reportingError } from './reporting-local.transport';

@Component({
  standalone: true,
  selector: 'sager-cleaning-form-local',
  imports: [
    SearchableSelectDirective,
    UnsavedFormDirective,
    RouterLink,
    ReactiveFormsModule,
    CommunicationsStateComponent,
    CleaningCriteriaFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page comm-narrow">
      <header class="op-heading">
        <div>
          <a class="op-back" [routerLink]="id ? ['/limpeza', id] : '/limpeza'"
            ><span class="back-arrow" aria-hidden="true">←</span>Avaliações de limpeza</a
          >
          <h1>{{ id ? 'Corrigir avaliação de limpeza' : 'Registrar avaliação de limpeza' }}</h1>
          <p>
            {{
              id
                ? 'Corrija as notas; as antigas ficam guardadas no histórico.'
                : 'Dê uma nota de 0 a 10 para cada item do quarto.'
            }}
          </p>
        </div>
      </header>
      <sager-communications-state
        [demo]="session.active()"
        [blocked]="!allowed()"
        [loading]="loading()"
        [error]="error()"
        (retry)="load()"
      />
      @if (!session.active() && allowed() && !loading() && !error()) {
        <section class="panel op-panel">
          @if (existing(); as item) {
            <dl class="comm-definition">
              <div>
                <dt>Quarto</dt>
                <dd>{{ item.roomCode }}</dd>
              </div>
              <div>
                <dt>Avaliado em</dt>
                <dd>{{ formatTime(item.evaluatedAt) }}</dd>
              </div>
            </dl>
          }
          <form
            sagerUnsaved
            [sagerSaving]="busy"
            [formGroup]="form"
            (ngSubmit)="step() < 3 ? next() : save()"
            novalidate
          >
            <p class="step-count">Passo {{ id ? step() - 1 : step() }} de {{ id ? 2 : 3 }}</p>
            <h2 id="cleaning-step-title" tabindex="-1">{{ titles[step() - 1] }}</h2>
            @switch (step()) {
              @case (1) {
                <div class="comm-form-grid">
                  <label class="field"
                    >Alojamento<select sagerSearchable formControlName="accommodationId">
                      <option value="">Todos os alojamentos</option>
                      @for (item of housing().accommodations; track item.id) {
                        <option [value]="item.id">{{ item.name }}</option>
                      }
                    </select></label
                  ><label class="field"
                    >Casa ou bloco<select sagerSearchable formControlName="unitId">
                      <option value="">Todas as casas e blocos</option>
                      @for (unit of visibleUnits(); track unit.id) {
                        <option [value]="unit.id">{{ unitLabel(unit) }}</option>
                      }
                    </select></label
                  ><label class="field"
                    >Quarto<select id="cleaning-room" sagerSearchable formControlName="roomId">
                      <option value="">Selecione o quarto</option>
                      @for (room of visibleRooms(); track room.id) {
                        <option [value]="room.id">{{ roomLabel(room) }}</option>
                      }
                    </select></label
                  >
                </div>
                <details
                  class="more-details"
                  [open]="form.controls.timeMode.value === 'RETROACTIVE'"
                  (toggle)="otherDay($any($event.target).open)"
                >
                  <summary>Foi em outro dia?</summary>
                  <div class="comm-form-grid">
                    <label class="field"
                      >Data e hora da avaliação<input
                        id="cleaning-time"
                        type="datetime-local"
                        formControlName="civilTime"
                      /><span class="field-hint"
                        >Horário de Brasília. Não pode ser no futuro.</span
                      ></label
                    ><label class="field"
                      >Por que está registrando depois?<textarea
                        id="cleaning-reason"
                        rows="3"
                        maxlength="2000"
                        formControlName="registrationReason"
                      ></textarea
                      ><span class="field-hint">De 10 a 2.000 caracteres.</span></label
                    >
                  </div>
                </details>
              }
              @case (2) {
                <sager-cleaning-criteria-fields [form]="criteria" />
                <p class="comm-help">
                  Média: <strong>{{ decimal(preview()) }}</strong>
                </p>
                <label class="field"
                  >Observação da avaliação<textarea
                    id="cleaning-observation"
                    rows="4"
                    maxlength="2000"
                    formControlName="observation"
                  ></textarea
                  ><span class="field-hint">Até 2.000 caracteres.</span></label
                >
              }
              @default {
                <dl class="comm-definition">
                  @for (line of summary(); track line.label) {
                    <div>
                      <dt>{{ line.label }}</dt>
                      <dd>{{ line.value }}</dd>
                    </div>
                  }
                </dl>
                @if (id) {
                  <label class="field"
                    >Motivo da correção<textarea
                      id="cleaning-correction"
                      rows="3"
                      maxlength="2000"
                      formControlName="correctionReason"
                    ></textarea
                    ><span class="field-hint">De 10 a 2.000 caracteres.</span></label
                  >
                }
              }
            }
            @if (actionError()) {
              <p class="comm-error" role="alert">{{ actionError() }}</p>
            }
            @if (conflict()) {
              <p class="comm-warning" role="alert">
                Outra pessoa alterou esta avaliação. Recarregue, confira e tente de novo.
              </p>
              <button class="btn-secondary" type="button" (click)="load()">Recarregar dados</button>
            }
            <div class="step-actions">
              @if (step() > (id ? 2 : 1)) {
                <button class="btn-secondary" type="button" (click)="go(step() - 1)">Voltar</button>
              }
              <button class="btn" type="submit" [disabled]="busy() || conflict()">
                {{ step() < 3 ? 'Continuar' : busy() ? 'Salvando…' : 'Salvar avaliação' }}
              </button>
            </div>
          </form>
        </section>
      }
    </main>
  `,
  styleUrl: './cleaning-local.scss',
})
export class CleaningFormLocalPage {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(CleaningLocalApiService);
  private readonly roomApi = inject(RoomApiService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly titles = ['Qual quarto?', 'Notas', 'Conferir e salvar'];
  /** A correção começa em "Notas": o quarto e a hora da avaliação não mudam. */
  readonly step = signal(this.id ? 2 : 1);
  readonly criteria = criteriaForm();
  readonly form = new FormGroup({
    accommodationId: new FormControl('', { nonNullable: true }),
    unitId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    timeMode: new FormControl<'NOW' | 'RETROACTIVE'>('NOW', { nonNullable: true }),
    civilTime: new FormControl('', { nonNullable: true }),
    registrationReason: new FormControl('', { nonNullable: true }),
    observation: new FormControl('', { nonNullable: true }),
    correctionReason: new FormControl('', { nonNullable: true }),
  });
  private readonly location = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly housing = signal<HousingMap>({ accommodations: [], units: [], rooms: [] });
  readonly visibleUnits = computed(() => unitsIn(this.housing(), this.location().accommodationId));
  readonly visibleRooms = computed(() =>
    roomsIn(this.housing(), this.location().accommodationId, this.location().unitId),
  );
  readonly existing = signal<CleaningAssessment | null>(null);
  readonly policy = signal<CleaningPolicy | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly conflict = signal(false);
  private readonly intent = new CommunicationIntent();
  readonly formatTime = formatCommunicationTime;
  readonly decimal = decimal;
  constructor() {
    cascadeLocation(this.form.controls);
    void this.load();
  }
  allowed(): boolean {
    return this.session.hasRole('supervisor');
  }
  roomLabel(room: RoomRecord): string {
    return roomOptionLabel(room, this.housing().units);
  }
  unitLabel(unit: AccommodationUnit): string {
    return unitOptionLabel(unit, this.housing(), this.location().accommodationId);
  }
  preview(): number | null {
    return previewCleaningScore(criteriaInput(this.criteria));
  }
  /** Abrir "Foi em outro dia?" é escolher a avaliação de outro dia; fechar volta a "agora". */
  otherDay(open: boolean): void {
    if (open !== (this.form.controls.timeMode.value === 'RETROACTIVE'))
      this.form.controls.timeMode.setValue(open ? 'RETROACTIVE' : 'NOW');
  }
  private input(): CleaningInput {
    const value = this.form.getRawValue();
    return cleaningPlan(
      value.roomId,
      this.id ? 'NOW' : value.timeMode,
      criteriaInput(this.criteria),
      value.observation,
      value.civilTime,
      value.registrationReason,
    );
  }
  /** O que o passo 3 mostra antes de salvar, no lugar do antigo diálogo de revisão. */
  summary(): { label: string; value: string }[] {
    const existing = this.existing();
    const input = this.input();
    return [
      {
        label: 'Quarto',
        value:
          existing?.roomCode ??
          this.housing().rooms.find((room) => room.id === input.roomId)?.code ??
          '',
      },
      {
        label: 'Avaliado em',
        value: existing
          ? this.formatTime(existing.evaluatedAt)
          : input.timeMode === 'NOW'
            ? 'Agora'
            : this.formatTime(input.evaluatedAt ?? ''),
      },
      ...(input.registrationReason
        ? [{ label: 'Por que registrou depois', value: input.registrationReason }]
        : []),
      ...criteriaKeys.map((key) => ({
        label: criterionLabels[key],
        value: decimal(input.criteria[key]),
      })),
      { label: 'Média', value: decimal(previewCleaningScore(input.criteria)) },
      ...(input.observation ? [{ label: 'Observação', value: input.observation }] : []),
    ];
  }
  /** Erro do passo e o id do campo que recebe o foco; erro vazio quando o passo está completo. */
  private stepError(step: number): [string, string] {
    const input = this.input();
    if (step === 1) {
      if (!this.visibleRooms().some((room) => room.id === input.roomId))
        return ['Escolha o quarto.', 'cleaning-room'];
      const retro = retroactiveError(input, this.policy()?.now ?? '');
      return [retro, retro.startsWith('Informe') ? 'cleaning-time' : 'cleaning-reason'];
    }
    if (step === 2) {
      const invalid = criteriaKeys.find((key) => this.criteria.controls[key].invalid);
      return [
        cleaningInputError({ ...input, timeMode: 'NOW' }, ''),
        invalid ? `cleaning-${invalid}` : 'cleaning-observation',
      ];
    }
    const reason = this.form.controls.correctionReason.value.trim();
    return this.id && (reason.length < 10 || reason.length > 2000)
      ? ['Explique a correção em 10 a 2.000 caracteres.', 'cleaning-correction']
      : ['', ''];
  }
  go(step: number): void {
    this.actionError.set('');
    this.step.set(step);
    afterNextRender(() => document.getElementById('cleaning-step-title')?.focus(), {
      injector: this.injector,
    });
  }
  /** Continuar valida só o passo atual e leva o foco ao primeiro campo com problema. */
  next(): void {
    const [error, field] = this.stepError(this.step());
    if (error) return this.fail(error, field);
    this.go(this.step() + 1);
  }
  private fail(error: string, field: string): void {
    if (this.step() === 2) this.criteria.markAllAsTouched();
    this.actionError.set(error);
    afterNextRender(() => document.getElementById(field)?.focus(), { injector: this.injector });
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.allowed()) return;
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');
    this.conflict.set(false);
    try {
      const [policy, housing, item] = await Promise.all([
        this.api.policy(),
        this.id ? Promise.resolve(null) : this.roomApi.map(),
        this.id ? this.api.get(this.id) : Promise.resolve(null),
      ]);
      this.policy.set(policy);
      if (housing) this.housing.set(housing);
      this.existing.set(item);
      if (item) {
        this.criteria.setValue(item.criteria);
        this.form.controls.observation.setValue(item.observation ?? '');
      }
    } catch (error) {
      this.error.set(reportingError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async save(): Promise<void> {
    if (this.busy() || this.conflict() || this.session.active() || !this.allowed()) return;
    const [error, field] = this.stepError(3);
    if (error) return this.fail(error, field);
    const input = this.input();
    const existing = this.existing();
    this.busy.set(true);
    this.actionError.set('');
    try {
      // A hora do servidor pode ter mudado desde o passo 1; a regra continua sendo a do servidor.
      const freshError = cleaningInputError(input, (await this.api.policy()).now);
      if (freshError) {
        this.actionError.set(freshError);
        return;
      }
      if (this.id) {
        const fresh = await this.api.get(this.id);
        if (!existing || fresh.version !== existing.version) {
          this.conflict.set(true);
          return;
        }
      }
      const saved =
        this.id && existing
          ? await this.api.correct(this.id, {
              version: existing.version,
              criteria: input.criteria,
              observation: input.observation,
              reason: this.form.controls.correctionReason.value.trim(),
            })
          : await this.api.create({ ...input, idempotencyKey: this.intent.for(input) });
      this.busy.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/limpeza', saved.id]);
    } catch (error) {
      if (error instanceof ReportingApiError && error.status === 409) this.conflict.set(true);
      this.actionError.set(reportingError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
