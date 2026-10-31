import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { trimmedLength } from '../../shared/field-rules';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsApiError, operationsError } from './operations-local-api.service';
import {
  eligibilityBlocker,
  formatOperationsTime,
  minutesAfter,
  nextReturn,
  periodHint,
  saoPauloInput,
  saoPauloInstant,
  serverClock,
} from './operations-local.utils';
import { LongExitApiService } from './long-exit-api.service';
import { LongExit, LongExitEligibility, LongExitInput } from './long-exit.models';
import { guardianBlocker, longExitFormError, longPeriodError } from './long-exit.utils';

@Component({
  standalone: true,
  selector: 'app-long-exit-form',
  imports: [SearchableSelectDirective, UnsavedFormDirective, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page op-page op-narrow">
      <header class="op-heading">
        <div>
          <a routerLink="/saidas" [queryParams]="{ tipo: 'longa' }" class="op-back"
            >← Saídas longas</a
          >
          <h1>{{ editing ? 'Mudar saída longa' : 'Pedir saída longa' }}</h1>
          <p>Diga quando você sai e quando volta, e escolha quem vai autorizar pelo WhatsApp.</p>
        </div>
      </header>
      @if (session.active()) {
        <section class="op-empty" role="status">
          <h2>Esta tela não faz parte da demonstração</h2>
          <p>Na demonstração, use as solicitações demonstrativas da lista de saídas.</p>
          <a class="btn op-primary" routerLink="/saidas">Abrir demonstração de saídas</a>
        </section>
      } @else if (!session.hasRole('residente')) {
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
          <button class="btn op-secondary" type="button" (click)="load()">Tentar novamente</button>
        </section>
      } @else if (eligibility(); as resident) {
        @if (!resident.eligible || !eligibleGuardianCount()) {
          <section class="op-empty" role="alert">
            <h2>Você não pode pedir esta saída agora</h2>
            <ul>
              @for (blocker of resident.blockers; track blocker) {
                <li>{{ blockerLabel(blocker) }}</li>
              }
              @if (!eligibleGuardianCount()) {
                <li>
                  Você precisa de um responsável com telefone válido no sistema. Fale com o
                  supervisor.
                </li>
              }
            </ul>
          </section>
        } @else if (editing && !original()?.capabilities?.canEdit) {
          <section class="op-empty" role="alert">
            <h2>Não é possível mudar este pedido</h2>
            <p>
              Você só pode mudar o pedido enquanto ele espera resposta, antes de sair e dentro do
              prazo.
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
              Saída longa: mais de 3 horas. Seu responsável precisa autorizar antes de o supervisor
              aprovar.
            </p>
            <div class="op-form-grid">
              <label class="field"
                >Quando você quer sair?<select
                  sagerSearchable
                  formControlName="departureMode"
                  (change)="departureChanged()"
                >
                  <option value="NOW">Agora</option>
                  <option value="SCHEDULED">Escolher data e hora</option>
                </select></label
              ><label class="field"
                >Quem vai autorizar?<select sagerSearchable formControlName="guardianId" required>
                  <option value="">Escolha quem vai autorizar</option>
                  @for (guardian of resident.guardians; track guardian.id) {
                    <option [value]="guardian.id" [disabled]="!guardian.eligible">
                      {{ guardian.name }} · {{ guardian.relationship
                      }}{{ guardian.eligible ? '' : ' · não pode autorizar' }}
                    </option>
                  }
                </select>
                @if (form.controls.guardianId.touched && form.controls.guardianId.invalid) {
                  <span class="op-field-error">Escolha quem vai autorizar.</span>
                }
              </label>
            </div>
            @if (hasUnavailableGuardians()) {
              <details class="guardian-check">
                <summary>Quem não pode autorizar e por quê</summary>
                <ul>
                  @for (guardian of resident.guardians; track guardian.id) {
                    @if (!guardian.eligible) {
                      <li>
                        <strong>{{ guardian.name }}</strong>
                        @for (blocker of guardian.blockers; track blocker) {
                          <span> · {{ guardianBlockerLabel(blocker) }}</span>
                        }
                      </li>
                    }
                  }
                </ul>
              </details>
            }
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
                  aria-describedby="long-exit-period-hint"
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
            <p class="op-help" id="long-exit-period-hint">
              @if (hint.duration) {
                Duração: {{ hint.duration }} (mínimo: mais de 3 h).
              } @else {
                Duração mínima: mais de 3 h.
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
              }</label
            ><label class="field"
              >Observações (opcional)<textarea
                rows="3"
                maxlength="2000"
                formControlName="notes"
              ></textarea>
            </label>
            @if (!resident.providers.whatsappEnabled) {
              <p class="op-warning">
                O envio do pedido para seu responsável está fora do ar. Seu pedido fica salvo. Avise
                a equipe da residência.
              </p>
            }
            @if (editing) {
              <p class="op-warning">
                Se você mudar o pedido, seu responsável precisa autorizar de novo.
              </p>
            }
            @if (error()) {
              <p class="op-error" role="alert">{{ error() }}</p>
            }
            @if (conflict()) {
              <button type="button" class="btn op-secondary" (click)="load()">
                Recarregar dados
              </button>
              <p class="op-help">Recarregar troca o que você digitou pelos dados salvos.</p>
            }
            <div class="op-actions">
              <a class="btn op-secondary" routerLink="/saidas" [queryParams]="{ tipo: 'longa' }"
                >Cancelar</a
              ><button
                class="btn op-primary"
                type="submit"
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
  styles: [
    `
      :host {
        display: block;
      }
      .guardian-check {
        margin: 18px 0;
      }
      summary {
        min-height: 44px;
        display: flex;
        align-items: center;
        cursor: pointer;
        color: var(--green-800);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      li {
        margin: 8px 0;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class LongExitFormComponent {
  readonly session = inject(DemoSessionService);
  private readonly api = inject(LongExitApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly editing = !!this.id;
  readonly eligibility = signal<LongExitEligibility | null>(null);
  readonly original = signal<LongExit | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly conflict = signal<string | null>(null);
  readonly returnNotice = signal('');
  private clock: () => string = () => '';
  private savedReturn = false;
  readonly blockerLabel = eligibilityBlocker;
  readonly guardianBlockerLabel = guardianBlocker;
  readonly form = new FormGroup({
    departureMode: new FormControl<'NOW' | 'SCHEDULED'>('NOW', { nonNullable: true }),
    guardianId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    departure: new FormControl('', { nonNullable: true }),
    expectedReturn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [trimmedLength(3, 2000)],
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  constructor() {
    if (!this.session.active() && this.session.hasRole('residente')) void this.load();
  }
  eligibleGuardianCount(): number {
    return this.eligibility()?.guardians.filter((guardian) => guardian.eligible).length ?? 0;
  }
  hasUnavailableGuardians(): boolean {
    return this.eligibility()?.guardians.some((guardian) => !guardian.eligible) ?? false;
  }
  async load(): Promise<void> {
    if (this.session.active() || !this.session.hasRole('residente') || this.saving()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.conflict.set(null);
    this.returnNotice.set('');
    try {
      const [eligibility, original] = await Promise.all([
        this.api.eligibility(),
        this.editing ? this.api.get(this.id) : Promise.resolve(null),
      ]);
      this.eligibility.set(eligibility);
      this.original.set(original);
      this.clock = serverClock(eligibility.now);
      this.savedReturn = !!original;
      this.form.reset({
        departureMode: original?.departureMode ?? 'NOW',
        guardianId: original?.guardianId ?? '',
        departure:
          original?.departureMode === 'SCHEDULED'
            ? saoPauloInput(original.requestedDepartureAt)
            : '',
        expectedReturn: saoPauloInput(
          original?.expectedReturnAt ?? minutesAfter(eligibility.now, 240),
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
  departureChanged(): void {
    const control = this.form.controls.expectedReturn;
    this.error.set('');
    this.returnNotice.set('');
    const next = nextReturn(
      this.departure(),
      saoPauloInstant(control.value),
      this.returnEdited(),
      240,
      longPeriodError,
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
      181,
      null,
      longPeriodError,
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
      this.form.controls.expectedReturn.setValue(saoPauloInput(minutesAfter(this.clock(), 240)));
  }
  async save(): Promise<void> {
    const eligibility = this.eligibility();
    const original = this.original();
    if (
      this.session.active() ||
      !this.session.hasRole('residente') ||
      !eligibility?.eligible ||
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
    const input: LongExitInput = {
      departureMode: value.departureMode,
      guardianId: value.guardianId,
      expectedReturnAt,
      reason: value.reason.trim(),
      notes: value.notes.trim() || null,
      ...(requestedDepartureAt ? { requestedDepartureAt } : {}),
    };
    const invalid = longExitFormError(input, this.clock());
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    if (
      !eligibility.guardians.some(
        (guardian) => guardian.id === input.guardianId && guardian.eligible,
      )
    ) {
      this.error.set('Esta pessoa não pode autorizar. Escolha outra.');
      return;
    }
    this.saving.set(true);
    try {
      const fresh = await this.api.eligibility();
      this.eligibility.set(fresh);
      this.clock = serverClock(fresh.now);
      if (
        !fresh.eligible ||
        !fresh.guardians.some((guardian) => guardian.id === input.guardianId && guardian.eligible)
      ) {
        this.error.set(
          'O cadastro ou o responsável deixou de atender aos requisitos. Revise os dados.',
        );
        return;
      }
      this.refreshNowReturn();
      input.expectedReturnAt =
        saoPauloInstant(this.form.controls.expectedReturn.value) ?? input.expectedReturnAt;
      const invalid = longExitFormError(input, fresh.now);
      if (invalid) {
        this.error.set(invalid);
        return;
      }
      const exit = await this.api.save(input, original ?? undefined);
      this.saving.set(false);
      this.form.markAsPristine();
      await this.router.navigate(['/saidas/longas', exit.id], { queryParams: { saved: '1' } });
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
