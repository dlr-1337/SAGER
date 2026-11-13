import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { trimmedLength } from '../../shared/field-rules';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { longPeriodError } from './long-exit.utils';
import { ExitKind, OperationsDemoService } from './operations-demo.service';
import { nextReturn, periodHint, shortPeriodError } from './operations-local.utils';

function localDateTime(date: Date): string {
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A partially typed year stays ignored until it reaches a plausible value. */
function localInstant(input: string): string | null {
  const date = new Date(input);
  return date.getFullYear() >= 1900 ? date.toISOString() : null;
}

function localInput(instant: string): string {
  return localDateTime(new Date(instant));
}

import { ExitFormLocalComponent } from './exit-form-local.component';
@Component({
  standalone: true,
  selector: 'app-exit-form',
  imports: [
    UnsavedFormDirective,
    ExitFormLocalComponent,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.active()) {
      <app-exit-form-local />
    } @else {
      <main class="page op-page op-narrow">
        @if (!session.hasRole('residente')) {
          <section class="op-empty" role="alert">
            <h1>Acesso restrito</h1>
            <p>O pedido é feito pelo residente menor de idade.</p>
            <a class="btn op-primary" routerLink="/saidas">Voltar às saídas</a>
          </section>
        } @else if (editing && !editable) {
          <section class="op-empty" role="alert">
            <h1>Edição indisponível</h1>
            <p>Somente solicitações pendentes do residente podem ser alteradas.</p>
            <a class="btn op-primary" routerLink="/saidas">Voltar às saídas</a>
          </section>
        } @else {
          <header class="op-heading">
            <div>
              <a routerLink="/saidas" class="op-back">← Saídas</a>
              <h1>{{ editing ? 'Editar solicitação' : 'Pedir saída' }}</h1>
              <p>Preencha os horários e o motivo. O supervisor analisará o pedido.</p>
            </div>
            <span class="op-demo-label">Simulação</span>
          </header>
          <form
            sagerUnsaved
            class="panel op-panel op-form"
            [formGroup]="form"
            (ngSubmit)="save()"
            novalidate
          >
            <fieldset class="op-type-choice">
              <legend>Tipo de saída</legend>
              <label [class.selected]="form.controls.kind.value === 'Curta'"
                ><input type="radio" formControlName="kind" value="Curta" /><strong>Curta</strong
                ><span
                  >Até 3 horas; retorno confirmado presencialmente pelo supervisor.</span
                ></label
              >
              <label [class.selected]="form.controls.kind.value === 'Longa'"
                ><input type="radio" formControlName="kind" value="Longa" /><strong>Longa</strong
                ><span
                  >Exige autorização do responsável legal pelo WhatsApp, conferida por um servidor,
                  e aprovação do supervisor.</span
                ></label
              >
            </fieldset>
            @let hint = periodHint();
            <div class="op-form-grid">
              <label class="field"
                >Data e hora de saída<input
                  type="datetime-local"
                  formControlName="departure"
                  [attr.min]="departureMin()"
                  (change)="departureChanged()"
                />
                @if (form.controls.departure.touched && form.controls.departure.invalid) {
                  <span class="op-field-error">Informe a data e hora de saída.</span>
                }
              </label>
              <label class="field"
                >{{ form.controls.kind.value === 'Curta' ? 'Retorno previsto' : 'Fim do período'
                }}<input
                  type="datetime-local"
                  formControlName="expectedReturn"
                  [attr.min]="hint.returnMin"
                  [attr.max]="hint.returnMax"
                  aria-describedby="demo-exit-period-hint"
                  (input)="returnNotice.set('')"
                />
                @if (form.controls.expectedReturn.touched && form.controls.expectedReturn.invalid) {
                  <span class="op-field-error">Informe a data e hora de retorno.</span>
                }
                @if (hint.error) {
                  <span class="op-field-error">{{ hint.error }}</span>
                }
              </label>
            </div>
            <p class="op-help" id="demo-exit-period-hint">
              @if (hint.duration) {
                Duração: {{ hint.duration }} ({{
                  form.controls.kind.value === 'Curta' ? 'máx. 3 h' : 'mínimo: mais de 3 h'
                }}).
              } @else {
                {{
                  form.controls.kind.value === 'Curta'
                    ? 'Duração máxima: 3 h.'
                    : 'Duração mínima: mais de 3 h.'
                }}
              }
            </p>
            <div role="status">
              @if (returnNotice()) {
                <p class="op-warning">{{ returnNotice() }}</p>
              }
            </div>
            @if (form.controls.kind.value === 'Curta') {
              <p class="op-help">
                O retorno deve ocorrer em até 3 horas após a saída. Informe um horário posterior à
                saída.
              </p>
            } @else {
              <p class="op-help">
                Responsável pré-cadastrado neste cenário: Mariana Ribeiro. O envio e a conferência
                são simulados e não possuem validade jurídica.
              </p>
            }
            <label class="field"
              >Motivo da saída<input
                type="text"
                formControlName="reason"
                maxlength="160"
                placeholder="Explique o motivo"
              />
              @if (form.controls.reason.touched && form.controls.reason.invalid) {
                <span class="op-field-error">Informe o motivo da saída.</span>
              }
            </label>
            <label class="field"
              >Observações (opcional)<textarea
                rows="3"
                formControlName="notes"
                placeholder="Informação útil para a análise"
              ></textarea>
            </label>
            @if (editing && original?.kind === 'Longa') {
              <p class="op-warning">
                Ao alterar esta saída longa, o documento e a etapa de autorização são reiniciados no
                protótipo.
              </p>
            }
            @if (error()) {
              <p class="op-error" role="alert">{{ error() }}</p>
            }
            <div class="op-actions">
              <a class="btn op-secondary" routerLink="/saidas">Cancelar</a
              ><button class="btn op-primary" type="submit">
                <span class="material-symbols-outlined" aria-hidden="true">check</span>
                {{ editing ? 'Salvar alterações' : 'Enviar pedido' }}
              </button>
            </div>
          </form>
        }
      </main>
    }
  `,
})
export class ExitFormComponent {
  readonly session = inject(SessionService);
  private readonly service = inject(OperationsDemoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly returnNotice = signal('');
  readonly editing = !!this.route.snapshot.paramMap.get('id');
  private savedReturn = this.editing;
  readonly original = this.editing
    ? this.service.getExit(this.route.snapshot.paramMap.get('id')!)
    : undefined;
  readonly editable =
    !!this.original &&
    this.original.residentId === this.service.residentId &&
    ['Aguardando análise', 'Aguardando autorização', 'Falha no envio'].includes(
      this.original.status,
    );
  private readonly initialDeparture = this.original
    ? new Date(this.original.departure)
    : new Date();
  readonly form = new FormGroup({
    kind: new FormControl<ExitKind>(
      this.original?.kind ??
        (this.route.snapshot.queryParamMap.get('tipo') === 'longa' ? 'Longa' : 'Curta'),
      {
        nonNullable: true,
        validators: [Validators.required],
      },
    ),
    departure: new FormControl(localDateTime(this.initialDeparture), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    expectedReturn: new FormControl(
      localDateTime(
        this.original
          ? new Date(this.original.expectedReturn)
          : new Date(this.initialDeparture.getTime() + 3 * 3_600_000),
      ),
      { nonNullable: true, validators: [Validators.required] },
    ),
    reason: new FormControl(this.original?.reason ?? '', {
      nonNullable: true,
      validators: [trimmedLength(1, 2000)],
    }),
    notes: new FormControl(this.original?.notes ?? '', { nonNullable: true }),
  });

  constructor() {
    this.form.controls.kind.valueChanges.subscribe(() => {
      this.departureChanged();
      this.error.set('');
    });
  }

  departureChanged(): void {
    const control = this.form.controls.expectedReturn;
    const short = this.form.controls.kind.value === 'Curta';
    this.returnNotice.set('');
    const next = nextReturn(
      localInstant(this.form.controls.departure.value),
      localInstant(control.value),
      this.savedReturn || control.dirty,
      short ? 180 : 240,
      short ? shortPeriodError : longPeriodError,
    );
    if (!next) return;
    this.savedReturn = false;
    control.reset(next.value && localInput(next.value));
    if (next.adjusted)
      this.returnNotice.set(
        `Volta ajustada para ${new Date(next.value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}: o horário anterior não dava.`,
      );
  }

  departureMin(): string {
    return localDateTime(new Date());
  }

  periodHint() {
    const short = this.form.controls.kind.value === 'Curta';
    return periodHint(
      localInstant(this.form.controls.departure.value),
      localInstant(this.form.controls.expectedReturn.value),
      short ? 1 : 181,
      short ? 180 : null,
      short ? shortPeriodError : longPeriodError,
      localInput,
    );
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revise os campos obrigatórios indicados.');
      return;
    }
    try {
      const input = this.form.getRawValue();
      this.service.validateExit(input);
      const request = this.editing
        ? this.service.updateExit(this.original!.id, input)
        : this.service.createExit(input);
      this.form.markAsPristine();
      void this.router.navigate(['/saidas', request.id], { queryParams: { saved: '1' } });
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Não foi possível salvar a solicitação.',
      );
    }
  }
}
