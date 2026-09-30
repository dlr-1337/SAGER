import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  formatCivilDate,
  formatCommunicationTime,
} from '../communications/communications-local.utils';
import { RoomApiService } from '../management/room-api.service';
import { RoomRecord } from '../management/housing.models';
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
                ? 'A correção preserva o quarto, o instante avaliado, os participantes e todas as revisões anteriores.'
                : 'Registre a avaliação presencial do quarto com os quatro critérios institucionais.'
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
                <dt>Instante avaliado</dt>
                <dd>{{ formatTime(item.evaluatedAt) }}</dd>
              </div>
              <div>
                <dt>Versão consultada</dt>
                <dd>{{ item.version }}</dd>
              </div>
            </dl>
          }
          <form [formGroup]="form" (ngSubmit)="review()" novalidate>
            @if (!id) {
              <div class="comm-form-grid">
                <label class="field"
                  >Quarto<select formControlName="roomId">
                    <option value="">Selecione o quarto</option>
                    @for (room of rooms(); track room.id) {
                      <option [value]="room.id">{{ room.code }}</option>
                    }
                  </select></label
                ><label class="field"
                  >Momento da avaliação<select formControlName="timeMode">
                    <option value="NOW">Agora, pelo horário do servidor</option>
                    <option value="RETROACTIVE">Registrar uma avaliação anterior</option>
                  </select></label
                >
              </div>
              @if (form.controls.timeMode.value === 'RETROACTIVE') {
                <div class="comm-form-grid">
                  <label class="field"
                    >Instante real da avaliação<input
                      type="datetime-local"
                      formControlName="civilTime"
                    /><span class="field-hint">Horário de São Paulo, nunca futuro.</span></label
                  ><label class="field"
                    >Justificativa do registro histórico<textarea
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
              Peso de 25% por critério. Prévia da média: <strong>{{ decimal(preview()) }}</strong
              >. A nota gravada será calculada pelo servidor com duas casas decimais.
            </p>
            <label class="field"
              >Observação da avaliação<textarea
                rows="4"
                maxlength="2000"
                formControlName="observation"
              ></textarea
              ><span class="field-hint"
                >Até 2.000 caracteres. Nenhuma advertência é emitida automaticamente.</span
              ></label
            >
            @if (actionError()) {
              <p class="comm-error" role="alert">{{ actionError() }}</p>
            }
            @if (conflict()) {
              <p class="comm-warning" role="alert">
                A avaliação mudou. Atualize e confira a versão antes de corrigir.
              </p>
              <button class="btn-secondary" type="button" (click)="load()">
                Recarregar avaliação
              </button>
            }
            <div class="comm-actions">
              <button class="btn" type="submit" [disabled]="busy() || conflict()">
                {{
                  busy() ? 'Conferindo avaliação…' : id ? 'Revisar correção' : 'Revisar registro'
                }}</button
              ><a [routerLink]="id ? ['/limpeza', id] : '/limpeza'">Cancelar</a>
            </div>
          </form>
        </section>
        @if (policy(); as rules) {
          <p class="comm-help">
            Política {{ rules.version }} · data institucional {{ civil(rules.currentDate) }} ·
            horário de São Paulo.
          </p>
        }
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
    roomId: new FormControl('', { nonNullable: true }),
    timeMode: new FormControl<'NOW' | 'RETROACTIVE'>('NOW', { nonNullable: true }),
    civilTime: new FormControl('', { nonNullable: true }),
    registrationReason: new FormControl('', { nonNullable: true }),
    observation: new FormControl('', { nonNullable: true }),
  });
  readonly rooms = signal<RoomRecord[]>([]);
  readonly existing = signal<CleaningAssessment | null>(null);
  readonly policy = signal<CleaningPolicy | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly conflict = signal(false);
  private readonly intent = new CommunicationIntent();
  readonly formatTime = formatCommunicationTime;
  readonly civil = formatCivilDate;
  readonly decimal = decimal;
  constructor() {
    void this.load();
  }
  allowed(): boolean {
    return this.session.hasRole('supervisor');
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
      const [policy, rooms, item] = await Promise.all([
        this.api.policy(),
        this.id ? Promise.resolve([]) : this.roomApi.list(),
        this.id ? this.api.get(this.id) : Promise.resolve(null),
      ]);
      this.policy.set(policy);
      this.rooms.set(rooms);
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
    if (error || (!this.id && !this.rooms().some((room) => room.id === value.roomId))) {
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
            existing?.roomCode ?? this.rooms().find((room) => room.id === value.roomId)?.code ?? '',
        },
        {
          label: 'Instante avaliado',
          value: this.id
            ? this.formatTime(existing?.evaluatedAt ?? '')
            : value.timeMode === 'NOW'
              ? 'Agora, calculado pelo servidor ao gravar'
              : this.formatTime(input.evaluatedAt ?? ''),
        },
        ...criteriaKeys.map((key) => ({
          label: criterionLabels[key],
          value: decimal(criteria[key]),
        })),
        { label: 'Prévia da nota', value: decimal(previewCleaningScore(criteria)) },
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
                title: this.id ? 'Revisar correção da avaliação' : 'Revisar avaliação do quarto',
                action: this.id ? 'Confirmar correção' : 'Confirmar avaliação',
                lines,
                requireReason: !!this.id,
                warning: this.id
                  ? 'A nova revisão preserva as notas anteriores e será reavaliada pelas ocorrências derivadas. Não há sanção automática.'
                  : undefined,
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
      await this.router.navigate(['/limpeza', saved.id]);
    } catch (error) {
      if (error instanceof ReportingApiError && error.status === 409) this.conflict.set(true);
      this.actionError.set(reportingError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
