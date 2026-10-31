import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  CommunicationReviewDialogComponent,
  CommunicationReviewResult,
  CommunicationsStateComponent,
} from '../communications/communications-local.shared';
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
import { CleaningAssessment, CleaningPolicy } from './cleaning-local.models';
import {
  cleaningInputError,
  cleaningPlan,
  criterionLabels,
  criteriaKeys,
  decimal,
  previewCleaningScore,
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
            >← Avaliações de limpeza</a
          >
          <h1>{{ id ? 'Corrigir avaliação de limpeza' : 'Registrar avaliação de limpeza' }}</h1>
          <p>
            {{
              id
                ? 'Corrija as notas e explique o motivo. As notas antigas continuam guardadas.'
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
          <h2>Dados da avaliação</h2>
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
            (ngSubmit)="review()"
            novalidate
          >
            @if (!id) {
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
                  >Quarto<select sagerSearchable formControlName="roomId">
                    <option value="">Selecione o quarto</option>
                    @for (room of visibleRooms(); track room.id) {
                      <option [value]="room.id">{{ roomLabel(room) }}</option>
                    }
                  </select></label
                ><label class="field"
                  >Quando foi a avaliação?<select sagerSearchable formControlName="timeMode">
                    <option value="NOW">Agora</option>
                    <option value="RETROACTIVE">Registrar uma avaliação anterior</option>
                  </select></label
                >
              </div>
              @if (form.controls.timeMode.value === 'RETROACTIVE') {
                <div class="comm-form-grid">
                  <label class="field"
                    >Data e hora da avaliação<input
                      type="datetime-local"
                      formControlName="civilTime"
                    /><span class="field-hint"
                      >Horário de Brasília. Não pode ser no futuro.</span
                    ></label
                  ><label class="field"
                    >Por que está registrando depois?<textarea
                      rows="3"
                      maxlength="2000"
                      formControlName="registrationReason"
                    ></textarea
                    ><span class="field-hint">De 10 a 2.000 caracteres.</span></label
                  >
                </div>
              }
            }
            <h3>Critérios de limpeza</h3>
            <sager-cleaning-criteria-fields [form]="criteria" />
            <p class="comm-help">
              Média: <strong>{{ decimal(preview()) }}</strong>
            </p>
            <label class="field"
              >Observação da avaliação<textarea
                rows="4"
                maxlength="2000"
                formControlName="observation"
              ></textarea
              ><span class="field-hint">Até 2.000 caracteres.</span></label
            >
            @if (actionError()) {
              <p class="comm-error" role="alert">{{ actionError() }}</p>
            }
            @if (conflict()) {
              <p class="comm-warning" role="alert">
                Outra pessoa alterou esta avaliação. Clique em Recarregar, confira e tente de novo.
              </p>
              <button class="btn-secondary" type="button" (click)="load()">Recarregar dados</button>
            }
            <div class="comm-actions">
              <button class="btn" type="submit" [disabled]="busy() || conflict()">
                {{
                  busy() ? 'Conferindo avaliação…' : id ? 'Conferir correção' : 'Conferir avaliação'
                }}</button
              ><a [routerLink]="id ? ['/limpeza', id] : '/limpeza'">Cancelar</a>
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
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly criteria = criteriaForm();
  readonly form = new FormGroup({
    accommodationId: new FormControl('', { nonNullable: true }),
    unitId: new FormControl('', { nonNullable: true }),
    roomId: new FormControl('', { nonNullable: true }),
    timeMode: new FormControl<'NOW' | 'RETROACTIVE'>('NOW', { nonNullable: true }),
    civilTime: new FormControl('', { nonNullable: true }),
    registrationReason: new FormControl('', { nonNullable: true }),
    observation: new FormControl('', { nonNullable: true }),
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
  async review(): Promise<void> {
    if (this.busy() || this.conflict() || this.session.active() || !this.allowed()) return;
    const trigger = document.activeElement as HTMLElement | null;
    const value = this.form.getRawValue();
    const criteria = criteriaInput(this.criteria);
    const existing = this.existing();
    const input = cleaningPlan(
      value.roomId,
      value.timeMode,
      criteria,
      value.observation,
      value.civilTime,
      value.registrationReason,
    );
    const error = cleaningInputError(
      this.id ? { ...input, timeMode: 'NOW' } : input,
      this.policy()?.now ?? '',
    );
    if (error || (!this.id && !this.visibleRooms().some((room) => room.id === value.roomId))) {
      this.criteria.markAllAsTouched();
      this.actionError.set(error || 'Selecione um quarto cadastrado.');
      return;
    }
    this.busy.set(true);
    this.actionError.set('');
    try {
      const freshPolicy = await this.api.policy();
      const freshError = cleaningInputError(
        this.id ? { ...input, timeMode: 'NOW' } : input,
        freshPolicy.now,
      );
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
      const lines = [
        {
          label: 'Quarto',
          value:
            existing?.roomCode ??
            this.housing().rooms.find((room) => room.id === value.roomId)?.code ??
            '',
        },
        {
          label: 'Avaliado em',
          value: this.id
            ? this.formatTime(existing?.evaluatedAt ?? '')
            : value.timeMode === 'NOW'
              ? 'Agora'
              : this.formatTime(input.evaluatedAt ?? ''),
        },
        ...criteriaKeys.map((key) => ({
          label: criterionLabels[key],
          value: decimal(criteria[key]),
        })),
        { label: 'Média', value: decimal(previewCleaningScore(criteria)) },
      ];
      const result = await firstValueFrom(
        this.dialog
          .open<CommunicationReviewDialogComponent, unknown, CommunicationReviewResult>(
            CommunicationReviewDialogComponent,
            {
              width: '620px',
              maxWidth: 'calc(100vw - 24px)',
              autoFocus: 'first-tabbable',
              restoreFocus: true,
              data: {
                title: this.id ? 'Conferir correção da avaliação' : 'Conferir avaliação do quarto',
                action: this.id ? 'Confirmar correção' : 'Confirmar avaliação',
                lines,
                requireReason: !!this.id,
                warning: this.id ? 'As notas anteriores ficam guardadas no histórico.' : undefined,
              },
            },
          )
          .afterClosed(),
      );
      if (!result) {
        setTimeout(() => trigger?.isConnected && trigger.focus(), 0);
        return;
      }
      const saved =
        this.id && existing
          ? await this.api.correct(this.id, {
              version: existing.version,
              criteria,
              observation: input.observation,
              reason: result.reason,
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
