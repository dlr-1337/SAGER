import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { trimmedLength } from '../../shared/field-rules';
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
  minutesAfter,
  nextReturn,
  periodHint,
  saoPauloInput,
  saoPauloInstant,
  serverClock,
  shortExitFormError,
  shortPeriodError,
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
          <h1>{{ editing ? 'Mudar saída curta' : 'Pedir saída curta' }}</h1>
          <p>Diga quando você sai, quando volta e por quê. O supervisor vai ver seu pedido.</p>
        </div>
      </header>
      @if (!session.hasRole('residente')) {
        <section class="op-empty" role="alert">
          <h2>Acesso restrito</h2>
          <p>O pedido é feito pelo próprio residente menor de idade.</p>
        </section>
      } @else if (loading()) {
        <section class="op-state" role="status">
          <h2>Carregando seu pedido</h2>
          <p>Aguarde um momento.</p>
        </section>
      } @else if (loadError()) {
        <section class="op-state" role="alert">
          <h2>Não foi possível carregar o pedido</h2>
          <p>{{ loadError() }}</p>
          <button type="button" class="btn op-secondary" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (eligibility(); as resident) {
        @if (!resident.eligible) {
          <section class="op-empty" role="alert">
            <h2>Você não pode pedir esta saída agora</h2>
            <ul>
              @for (blocker of resident.blockers; track blocker) {
                <li>{{ blockerLabel(blocker) }}</li>
              }
            </ul>
          </section>
        } @else if (editing && !original()?.capabilities?.canEdit) {
          <section class="op-empty" role="alert">
            <h2>Não é possível mudar este pedido</h2>
            <p>Você só pode mudar o pedido enquanto ele espera resposta e dentro do prazo.</p>
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
              Saída curta: até 3 horas. Fale com o supervisor antes de sair e ao voltar. Vai ficar
              mais tempo? Peça uma saída longa.
            </p>
            <label class="field"
              >Quando você quer sair?<select
                sagerSearchable
                formControlName="departureMode"
                (change)="modeChanged()"
              >
                <option value="NOW">Agora</option>
                <option value="SCHEDULED">Escolher data e hora</option>
              </select></label
            >
            @let hint = periodHint();
            <div class="op-form-grid">
              @if (form.controls.departureMode.value === 'SCHEDULED') {
                <label class="field"
                  >Data e hora de saída<input
                    type="datetime-local"
                    formControlName="departure"
                    required
                    [attr.min]="departureMin()"
                    (change)="departureChanged()"
                  />
                  @if (form.controls.departure.touched && !form.controls.departure.value) {
                    <span class="op-field-error">Informe a data e hora de saída.</span>
                  }
                </label>
              }
              <label class="field"
                >Que horas você volta?<input
                  type="datetime-local"
                  formControlName="expectedReturn"
                  required
                  [attr.min]="hint.returnMin"
                  [attr.max]="hint.returnMax"
                  aria-describedby="exit-period-hint"
                  (input)="returnNotice.set('')"
                />
                @if (form.controls.expectedReturn.touched && form.controls.expectedReturn.invalid) {
                  <span class="op-field-error">Escolha a data e a hora da volta.</span>
                }
                @if (hint.error) {
                  <span class="op-field-error">{{ hint.error }}</span>
                }
              </label>
            </div>
            <p class="op-help" id="exit-period-hint">
              @if (hint.duration) {
                Duração: {{ hint.duration }} (máx. 3 h).
              } @else {
                Duração máxima: 3 h.
              }
            </p>
            <div role="status">
              @if (returnNotice()) {
                <p class="op-warning">{{ returnNotice() }}</p>
              }
            </div>
            <label class="field"
              >Por que você quer sair?<textarea
                rows="3"
                maxlength="2000"
                formControlName="reason"
                required
              ></textarea>
              @if (form.controls.reason.touched && form.controls.reason.invalid) {
                <span class="op-field-error">Escreva o motivo da saída.</span>
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
                Recarregar dados
              </button>
              <p class="op-help">Recarregar troca o que você digitou pelos dados salvos.</p>
            }
            <div class="op-actions">
              <a routerLink="/saidas" class="btn op-secondary">Cancelar</a
              ><button
                type="submit"
                class="btn op-primary"
                [disabled]="saving() || conflict() === 'stale_version'"
              >
                {{
                  saving() ? 'Enviando pedido…' : editing ? 'Salvar alterações' : 'Enviar pedido'
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
  readonly conflict = signal<string | null>(null);
  readonly returnNotice = signal('');
  private clock: () => string = () => '';
  private savedReturn = false;
  readonly blockerLabel = eligibilityBlocker;
  readonly form = new FormGroup({
    departureMode: new FormControl<'NOW' | 'SCHEDULED'>('NOW', { nonNullable: true }),
    departure: new FormControl('', { nonNullable: true }),
    expectedReturn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 2000)],
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
    this.conflict.set(null);
    this.returnNotice.set('');
    try {
      const [eligibility, original] = await Promise.all([
        this.api.eligibility(),
        this.editing ? this.api.exit(this.id) : Promise.resolve(null),
      ]);
      this.eligibility.set(eligibility);
      this.original.set(original);
      this.clock = serverClock(eligibility.now);
      this.savedReturn = !!original;
      this.form.reset({
        departureMode: original?.departureMode ?? 'NOW',
        departure:
          original?.departureMode === 'SCHEDULED'
            ? saoPauloInput(original.requestedDepartureAt)
            : '',
        expectedReturn: saoPauloInput(
          original?.expectedReturnAt ?? minutesAfter(eligibility.now, 180),
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
    const control = this.form.controls.expectedReturn;
    this.returnNotice.set('');
    const next = nextReturn(
      this.departure(),
      saoPauloInstant(control.value),
      this.returnEdited(),
      180,
      shortPeriodError,
    );
    if (!next) return;
    this.savedReturn = false;
    control.reset(saoPauloInput(next.value));
    if (next.adjusted)
      this.returnNotice.set(
        `Volta ajustada para ${formatOperationsTime(next.value)}, porque o horário anterior não dava.`,
      );
  }
  departureMin(): string {
    return saoPauloInput(minutesAfter(this.clock(), 1));
  }
  periodHint() {
    return periodHint(
      this.departure(),
      saoPauloInstant(this.form.controls.expectedReturn.value),
      1,
      180,
      shortPeriodError,
    );
  }
  private departure(): string | null {
    return this.form.controls.departureMode.value === 'NOW'
      ? this.clock()
      : saoPauloInstant(this.form.controls.departure.value);
  }
  private returnEdited(): boolean {
    return this.savedReturn || this.form.controls.expectedReturn.dirty;
  }
  private refreshNowReturn(): void {
    if (this.form.controls.departureMode.value === 'NOW' && !this.returnEdited())
      this.form.controls.expectedReturn.setValue(saoPauloInput(minutesAfter(this.clock(), 180)));
  }
  async save(): Promise<void> {
    const resident = this.eligibility();
    const original = this.original();
    if (
      !this.session.hasRole('residente') ||
      !resident?.eligible ||
      (this.editing && !original?.capabilities.canEdit) ||
      this.saving() ||
      this.conflict() === 'stale_version'
    )
      return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.conflict.set(null);
    // Removing the field in "Agora" drops its required rule without revalidating the control.
    this.form.controls.departure.updateValueAndValidity();
    if (this.form.invalid) {
      this.error.set('Revise os campos obrigatórios indicados.');
      return;
    }
    this.refreshNowReturn();
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
    const error = shortExitFormError(input, this.clock());
    if (error) {
      this.error.set(error);
      return;
    }
    this.saving.set(true);
    try {
      const fresh = await this.api.eligibility();
      this.eligibility.set(fresh);
      this.clock = serverClock(fresh.now);
      if (!fresh.eligible) {
        this.error.set('Seu cadastro deixou de atender aos requisitos da saída curta.');
        return;
      }
      this.refreshNowReturn();
      input.expectedReturnAt =
        saoPauloInstant(this.form.controls.expectedReturn.value) ?? input.expectedReturnAt;
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
      if (
        error instanceof OperationsApiError &&
        error.status === 409 &&
        error.code !== 'overlapping_exit'
      )
        this.conflict.set(error.code ?? 'conflict');
    } finally {
      this.saving.set(false);
    }
  }
}
