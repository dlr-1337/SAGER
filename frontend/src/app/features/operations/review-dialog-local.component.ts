import { SearchableSelectDirective } from '../../shared/searchable-select.directive';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CallMark, PhysicalExitInput } from './operations-local.models';
import {
  callMarkLabels,
  formatOperationsTime,
  saoPauloInput,
  saoPauloInstant,
  validJustification,
} from './operations-local.utils';

export interface LocalReviewData {
  title: string;
  action: string;
  lines: { label: string; value: string }[];
  warning?: string;
  requireConfirmation?: boolean;
  requireReason?: boolean;
  comment?: boolean;
  initialMark?: CallMark;
  authorizedExits?: { id: string; type: 'SHORT' | 'LONG' }[];
  physical?: {
    action: 'partida' | 'retorno';
    now: string;
    minimum: string;
    expectedReturnAt: string;
    version: number;
  };
}
export interface LocalReviewResult {
  reason: string;
  confirmed: boolean;
  mark?: CallMark;
  authorizedExit?: { id: string; type: 'SHORT' | 'LONG' };
  physical?: PhysicalExitInput;
}

@Component({
  standalone: true,
  selector: 'app-local-operation-review',
  imports: [SearchableSelectDirective, ReactiveFormsModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.warning) {
        <p class="op-warning" role="alert">{{ data.warning }}</p>
      }
      <dl class="review-list">
        @for (line of data.lines; track line.label) {
          <div>
            <dt>{{ line.label }}</dt>
            <dd>{{ line.value }}</dd>
          </div>
        }
      </dl>
      @if (data.initialMark) {
        <label class="field"
          >Marcação corrigida<select sagerSearchable [formControl]="mark">
            <option value="PRESENTE">Presente</option>
            <option value="AUSENTE">Ausente</option>
            @if (data.authorizedExits?.length) {
              <option value="AUSENCIA_JUSTIFICADA">Ausência justificada</option>
            }
          </select></label
        >
      }
      @if (mark.value === 'AUSENCIA_JUSTIFICADA' && (data.authorizedExits?.length ?? 0) > 1) {
        <label class="field"
          >Saída vinculada à ausência<select sagerSearchable [formControl]="authorizedExit">
            <option value="">Selecione a saída</option>
            @for (exit of data.authorizedExits; track exit.id) {
              <option [value]="exit.id">
                {{ exit.type === 'SHORT' ? 'Curta' : 'Longa' }} · {{ exit.id }}
              </option>
            }
          </select></label
        >
      }
      @if (data.physical; as physical) {
        <label class="field"
          >Horário do registro<select sagerSearchable [formControl]="timeMode">
            <option value="NOW">Agora, no momento da confirmação</option>
            <option value="RETROACTIVE">Informar horário anterior</option>
          </select></label
        >
        <p class="op-help">
          Horário de Brasília. Na opção “Agora”, a API registra a hora da confirmação:
          {{ formatTime(physical.now) }} na última consulta.
        </p>
        @if (timeMode.value === 'RETROACTIVE') {
          <label class="field"
            >{{
              physical.action === 'partida' ? 'Horário real da partida' : 'Horário real do retorno'
            }}<input type="datetime-local" [formControl]="time"
          /></label>
        }
      }
      @if (data.requireReason || data.comment || timeMode.value === 'RETROACTIVE') {
        <label class="field"
          >{{
            data.requireReason || timeMode.value === 'RETROACTIVE'
              ? 'Justificativa'
              : 'Comentário (opcional)'
          }}<textarea rows="3" maxlength="500" [formControl]="reason"></textarea>
        </label>
        @if (data.requireReason || timeMode.value === 'RETROACTIVE') {
          <p class="op-help">
            Descreva o motivo em 10 a 500 caracteres. O histórico preserva esta justificativa.
          </p>
        }
      }
      @if (data.physical?.action === 'retorno') {
        @if (late) {
          <p class="op-warning" role="status">
            O retorno está após o horário previsto. Registre a observação do atraso.
          </p>
        }
        <label class="field"
          >Observação do atraso{{ late ? '' : ' (se houver)'
          }}<textarea rows="3" maxlength="500" [formControl]="lateObservation"></textarea>
        </label>
        <p class="op-help">
          O retorno presencial é registrado mesmo quando a duração ultrapassa 3 horas.
        </p>
      }
      @if (data.requireConfirmation) {
        <label class="op-check"
          ><input type="checkbox" [formControl]="confirmation" />Confirmo o registro fora da janela
          de 22h a 23h30.</label
        >
      }
      @if (error()) {
        <p class="op-error" role="alert">{{ error() }}</p>
      }
      <p class="op-help">
        Confira os dados antes de confirmar. Cancelar fecha esta revisão sem gravar.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button type="button" class="btn op-secondary" (click)="dialogRef.close()">Cancelar</button
      ><button type="button" class="btn op-primary" (click)="confirm()">
        {{ data.action }}
      </button></mat-dialog-actions
    >
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--ink);
      }
      .review-list {
        margin: 0 0 24px;
      }
      .review-list div {
        display: grid;
        grid-template-columns: minmax(100px, 35%) 1fr;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--line);
      }
      dt {
        color: var(--muted);
      }
      dd {
        margin: 0;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .field {
        margin: 16px 0;
      }
      mat-dialog-actions {
        gap: 8px;
        padding: 16px 24px;
      }
      @media (max-width: 540px) {
        .review-list div {
          grid-template-columns: 1fr;
          gap: 3px;
        }
        mat-dialog-actions {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class LocalOperationsReviewDialogComponent {
  readonly data = inject<LocalReviewData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(
    MatDialogRef<LocalOperationsReviewDialogComponent, LocalReviewResult>,
  );
  readonly reason = new FormControl('', { nonNullable: true });
  readonly confirmation = new FormControl(false, { nonNullable: true });
  readonly timeMode = new FormControl<'NOW' | 'RETROACTIVE'>('NOW', { nonNullable: true });
  readonly time = new FormControl(this.data.physical ? saoPauloInput(this.data.physical.now) : '', {
    nonNullable: true,
  });
  readonly lateObservation = new FormControl('', { nonNullable: true });
  readonly mark = new FormControl<CallMark>(this.data.initialMark ?? 'PRESENTE', {
    nonNullable: true,
  });
  readonly authorizedExit = new FormControl('', { nonNullable: true });
  readonly error = signal('');
  readonly formatTime = formatOperationsTime;
  readonly markLabels = callMarkLabels;
  get late(): boolean {
    const physical = this.data.physical;
    const time = this.timeMode.value === 'NOW' ? physical?.now : saoPauloInstant(this.time.value);
    return (
      physical?.action === 'retorno' &&
      !!time &&
      Date.parse(time) > Date.parse(physical.expectedReturnAt)
    );
  }
  confirm(): void {
    this.error.set('');
    const reason = this.reason.value.trim();
    if (
      (this.data.requireReason || this.timeMode.value === 'RETROACTIVE') &&
      !validJustification(reason)
    ) {
      this.error.set('Informe uma justificativa com 10 a 500 caracteres.');
      return;
    }
    if (this.data.requireConfirmation && !this.confirmation.value) {
      this.error.set('Confirme expressamente o registro fora da janela.');
      return;
    }
    const result: LocalReviewResult = { reason, confirmed: this.confirmation.value };
    if (this.data.initialMark) {
      result.mark = this.mark.value;
      if (result.mark === 'AUSENCIA_JUSTIFICADA') {
        const options = this.data.authorizedExits ?? [];
        result.authorizedExit =
          options.length === 1
            ? options[0]
            : options.find((exit) => exit.id === this.authorizedExit.value);
        if (!result.authorizedExit) {
          this.error.set('Selecione a saída autorizada vinculada à ausência.');
          return;
        }
      }
    }
    if (this.data.physical) {
      const p = this.data.physical;
      result.physical = { version: p.version, timeMode: this.timeMode.value };
      if (this.timeMode.value === 'RETROACTIVE') {
        const time = saoPauloInstant(this.time.value);
        if (!time) {
          this.error.set('Informe uma data e hora válidas no horário de Brasília.');
          return;
        }
        if (Date.parse(time) > Date.parse(p.now)) {
          this.error.set(
            'O horário anterior não pode estar no futuro em relação à última consulta do servidor.',
          );
          return;
        }
        if (
          Date.parse(time) < Date.parse(p.minimum) ||
          (p.action === 'retorno' && Date.parse(time) === Date.parse(p.minimum))
        ) {
          this.error.set(
            p.action === 'retorno'
              ? 'O retorno deve ser posterior à partida presencial.'
              : 'A partida não pode ser anterior à saída solicitada.',
          );
          return;
        }
        result.physical.occurredAt = time;
        result.physical.justification = reason;
      }
      const observation = this.lateObservation.value.trim();
      if (this.late && !validJustification(observation)) {
        this.error.set('Informe uma observação do atraso com 10 a 500 caracteres.');
        return;
      }
      if (p.action === 'retorno' && observation) result.physical.lateObservation = observation;
    }
    this.dialogRef.close(result);
  }
}
