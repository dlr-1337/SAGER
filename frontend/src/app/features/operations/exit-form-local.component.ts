import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  OperationsApiError,
  OperationsLocalApiService,
  operationsError,
} from './operations-local-api.service';
import { ExitEligibility, ShortExit, ShortExitInput } from './operations-local.models';
import {
  eligibilityBlocker,
  formatOperationsTime,
  saoPauloInput,
  saoPauloInstant,
  shortExitFormError,
} from './operations-local.utils';

@Component({
  standalone: true,
  selector: 'app-exit-form-local',
  imports: [SearchableSelectDirective, UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-narrow">
      <header class="op-heading">
        <div>
          <a routerLink="/saidas" class="op-back">← Saídas</a>
          <h1>{{ editing ? 'Editar saída curta' : 'Solicitar saída curta' }}</h1>
          <p>Preencha os horários e o motivo para análise do supervisor.</p>
        </div>
      </header>
      @if (!session.hasRole('residente')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>O pedido é feito pelo próprio residente menor de idade.</p>
        </section>
      } @else if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando dados da solicitação</h2>
          <p>Verificando o cadastro e a disponibilidade da saída curta.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Não foi possível carregar a solicitação</h2>
          <p>{{ loadError() }}</p>
          <button type="button" class="btn op-secondary" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (eligibility(); as resident) {
        @if (!resident.eligible) {
          <section class="op-empty" role="alert">
            <h2>Solicitação indisponível</h2>
            <ul>
              @for (blocker of resident.blockers; track blocker) {
                <li>{{ blockerLabel(blocker) }}</li>
              }
            </ul>
            <p>Solicite a atualização do cadastro ao responsável pela residência.</p>
          </section>
        } @else if (editing && !original()?.capabilities?.canEdit) {
          <section class="op-empty" role="alert">
            <h2>Edição indisponível</h2>
            <p>
              Somente uma solicitação própria aguardando análise pode ser alterada dentro do prazo.
            </p>
          </section>
        } @else {
          <form
            sagerUnsaved
            [sagerSaving]="saving"
            class="panel op-panel op-form"
            [formGroup]="form"
            (ngSubmit)="save()"
            novalidate
          >
            <h2>Dados da saída</h2>
            <p>
              {{ resident.residentName }} · Matrícula {{ resident.enrollment }} · Quarto
              {{ resident.roomNumber }}
            </p>
            <p class="op-help">
              Saídas curtas duram até 3 horas. A partida e o retorno são confirmados presencialmente
              pelo supervisor. Para períodos maiores, solicite uma saída longa.
            </p>
            <label class="field"
              >Quando deseja sair?<select
                sagerSearchable
                formControlName="departureMode"
                (change)="modeChanged()"
              >
                <option value="NOW">Agora, após a análise e a liberação presencial</option>
                <option value="SCHEDULED">Agendar data e hora</option>
              </select></label
            >
            <div class="op-form-grid">
              @if (form.controls.departureMode.value === 'SCHEDULED') {
                <label class="field"
                  >Data e hora de saída<input
                    type="datetime-local"
                    formControlName="departure"
                    required
                    (change)="departureChanged()"
                  />
                  @if (form.controls.departure.touched && !form.controls.departure.value) {
                    <span class="op-field-error">Informe a data e hora de saída.</span>
                  }
                </label>
              }
              <label class="field"
                >Retorno previsto<input
                  type="datetime-local"
                  formControlName="expectedReturn"
                  required
                />
                @if (form.controls.expectedReturn.touched && form.controls.expectedReturn.invalid) {
                  <span class="op-field-error">Informe a data e hora de retorno.</span>
                }
              </label>
            </div>
            <p class="op-help">
              Horário de Brasília. Última consulta do servidor: {{ formatTime(resident.now) }}. Na
              opção “Agora”, a saída solicitada usa o horário de envio registrado pelo servidor.
            </p>
            <label class="field"
              >Motivo da saída<textarea
                rows="3"
                maxlength="2000"
                formControlName="reason"
                required
              ></textarea>
              @if (form.controls.reason.touched && form.controls.reason.invalid) {
                <span class="op-field-error">Informe um motivo com 3 a 2.000 caracteres.</span>
              }
            </label>
            <label class="field"
              >Observações (opcional)<textarea
                rows="3"
                maxlength="2000"
                formControlName="notes"
              ></textarea>
            </label>
            @if (error()) {
              <p class="op-error" role="alert">{{ error() }}</p>
            }
            @if (conflict()) {
              <button class="btn op-secondary" type="button" (click)="load()">
                Recarregar solicitação
              </button>
              <p class="op-help">Recarregar substitui os campos pelos dados atuais do servidor.</p>
            }
            <div class="op-actions">
              <a routerLink="/saidas" class="btn op-secondary">Cancelar</a
              ><button type="submit" class="btn op-primary" [disabled]="saving() || conflict()">
                {{
                  saving()
                    ? 'Salvando solicitação…'
                    : editing
                      ? 'Salvar alterações'
                      : 'Enviar solicitação'
                }}
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
})
export class ExitFormLocalComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(OperationsLocalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly editing = !!this.id;
  readonly eligibility = signal<ExitEligibility | null>(null);
  readonly original = signal<ShortExit | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly conflict = signal(false);
  readonly formatTime = formatOperationsTime;
  readonly blockerLabel = eligibilityBlocker;
  readonly form = new FormGroup({
    departureMode: new FormControl<'NOW' | 'SCHEDULED'>('NOW', { nonNullable: true }),
    departure: new FormControl('', { nonNullable: true }),
    expectedReturn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  constructor() {
    if (this.session.hasRole('residente')) void this.load();
  }
  async load(): Promise<void> {
    if (!this.session.hasRole('residente') || this.saving()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(false);
    try {
      const [eligibility, original] = await Promise.all([
        this.api.eligibility(),
        this.editing ? this.api.exit(this.id) : Promise.resolve(null),
      ]);
      this.eligibility.set(eligibility);
      this.original.set(original);
      this.form.reset({
        departureMode: original?.departureMode ?? 'NOW',
        departure: saoPauloInput(original?.requestedDepartureAt ?? eligibility.now),
        expectedReturn: saoPauloInput(
          original?.expectedReturnAt ??
            new Date(Date.parse(eligibility.now) + 3 * 3_600_000).toISOString(),
        ),
        reason: original?.reason ?? '',
        notes: original?.notes ?? '',
      });
    } catch (error) {
      this.loadError.set(operationsError(error));
    } finally {
      this.loading.set(false);
    }
  }
  modeChanged(): void {
    this.error.set('');
    this.departureChanged();
  }
  departureChanged(): void {
    const eligibility = this.eligibility();
    const departure =
      this.form.controls.departureMode.value === 'NOW'
        ? eligibility?.now
        : saoPauloInstant(this.form.controls.departure.value);
    if (departure)
      this.form.controls.expectedReturn.setValue(
        saoPauloInput(new Date(Date.parse(departure) + 3 * 3_600_000).toISOString()),
      );
  }
  async save(): Promise<void> {
    const resident = this.eligibility();
    const original = this.original();
    if (
      !this.session.hasRole('residente') ||
      !resident?.eligible ||
      (this.editing && !original?.capabilities.canEdit) ||
      this.saving() ||
      this.conflict()
    )
      return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) {
      this.error.set('Revise os campos obrigatórios indicados.');
      return;
    }
    const value = this.form.getRawValue();
    const expectedReturnAt = saoPauloInstant(value.expectedReturn);
    const requestedDepartureAt =
      value.departureMode === 'SCHEDULED' ? saoPauloInstant(value.departure) : null;
    if (!expectedReturnAt || (value.departureMode === 'SCHEDULED' && !requestedDepartureAt)) {
      this.error.set('Informe datas e horas válidas no horário de Brasília.');
      return;
    }
    const input: ShortExitInput = {
      departureMode: value.departureMode,
      expectedReturnAt,
      reason: value.reason.trim(),
      notes: value.notes.trim() || null,
      ...(requestedDepartureAt ? { requestedDepartureAt } : {}),
    };
    const error = shortExitFormError(input, resident.now);
    if (error) {
      this.error.set(error);
      return;
    }
    this.saving.set(true);
    try {
      const fresh = await this.api.eligibility();
      this.eligibility.set(fresh);
      if (!fresh.eligible) {
        this.error.set('Seu cadastro deixou de atender aos requisitos da saída curta.');
        return;
      }
      const freshError = shortExitFormError(input, fresh.now);
      if (freshError) {
        this.error.set(freshError);
        return;
      }
      const exit = await this.api.saveExit(input, original ?? undefined);
      this.saving.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/saidas', exit.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(operationsError(error));
      if (error instanceof OperationsApiError && error.status === 409) this.conflict.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
