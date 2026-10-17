import { UnsavedFormDirective } from '../../shared/unsaved-form';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { ExitKind, ExitRequest, OperationsDemoService } from './operations-demo.service';

function localDateTime(date: Date): string {
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
              <h1>{{ editing ? 'Editar solicitação' : 'Solicitar saída' }}</h1>
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
                  >Exige assinatura eletrônica do responsável legal via link no WhatsApp e aprovação
                  do supervisor.</span
                ></label
              >
            </fieldset>
            <div class="op-form-grid">
              <label class="field"
                >Data e hora de saída<input
                  type="datetime-local"
                  formControlName="departure"
                  (change)="departureChanged()"
                />
                @if (form.controls.departure.touched && form.controls.departure.invalid) {
                  <span class="op-field-error">Informe a data e hora de saída.</span>
                }
              </label>
              <label class="field"
                >{{ form.controls.kind.value === 'Curta' ? 'Retorno previsto' : 'Fim do período'
                }}<input type="datetime-local" formControlName="expectedReturn" />
                @if (form.controls.expectedReturn.touched && form.controls.expectedReturn.invalid) {
                  <span class="op-field-error">Informe a data e hora de retorno.</span>
                }
              </label>
            </div>
            @if (form.controls.kind.value === 'Curta') {
              <p class="op-help">
                O retorno deve ocorrer em até 3 horas após a saída. Informe um horário posterior à
                saída.
              </p>
            } @else {
              <p class="op-help">
                Responsável pré-cadastrado neste cenário: Mariana Ribeiro. A assinatura é simulada e
                não possui validade jurídica.
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
                Ao alterar esta saída longa, o documento e a etapa de assinatura são reiniciados no
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
                {{ editing ? 'Salvar alterações' : 'Enviar solicitação' }}
              </button>
            </div>
          </form>
        }
      </main>
    }
  `,
})
export class ExitFormComponent {
  readonly session = inject(DemoSessionService);
  private readonly service = inject(OperationsDemoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly editing = !!this.route.snapshot.paramMap.get('id');
  readonly original = this.editing
    ? this.service.getExit(this.route.snapshot.paramMap.get('id')!)
    : undefined;
  readonly editable =
    !!this.original &&
    this.original.residentId === this.service.residentId &&
    ['Aguardando análise', 'Aguardando assinatura', 'Falha no envio'].includes(
      this.original.status,
    );
  private readonly initialDeparture = this.original
    ? new Date(this.original.departure)
    : new Date();
  readonly form = new FormGroup({
    kind: new FormControl<ExitKind>(this.original?.kind ?? 'Curta', {
      nonNullable: true,
      validators: [Validators.required],
    }),
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
      validators: [Validators.required],
    }),
    notes: new FormControl(this.original?.notes ?? '', { nonNullable: true }),
  });

  constructor() {
    this.form.controls.kind.valueChanges.subscribe((kind) => {
      if (kind === 'Curta') this.departureChanged();
      this.error.set('');
    });
  }

  departureChanged(): void {
    if (this.form.controls.kind.value !== 'Curta') return;
    const departure = Date.parse(this.form.controls.departure.value);
    if (Number.isFinite(departure))
      this.form.controls.expectedReturn.setValue(
        localDateTime(new Date(departure + 3 * 3_600_000)),
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
