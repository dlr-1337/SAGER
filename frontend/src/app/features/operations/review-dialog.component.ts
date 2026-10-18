import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ReviewDialogData {
  title: string;
  action: string;
  lines: { label: string; value: string }[];
  mode?: 'simple' | 'reason' | 'return';
  expectedReturn?: string;
  warning?: string;
}

export interface ReviewDialogResult {
  reason: string;
  actualReturn?: string;
}

function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  standalone: true,
  selector: 'app-operations-review-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="review-dialog">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        @if (data.warning) {
          <p class="review-warning" role="alert">{{ data.warning }}</p>
        }
        <dl class="review-list">
          @for (line of data.lines; track line.label) {
            <div>
              <dt>{{ line.label }}</dt>
              <dd>{{ line.value }}</dd>
            </div>
          }
        </dl>
        @if (data.mode === 'return') {
          <label class="dialog-field"
            >Horário real do retorno
            <input
              type="datetime-local"
              [formControl]="actualReturn"
              (change)="actualReturn.markAsTouched()"
            />
          </label>
          @if (delayed) {
            <p class="review-warning">
              O horário informado está após o retorno previsto. Descreva o atraso.
            </p>
          }
          @if (actualReturn.touched && actualReturn.invalid) {
            <p class="field-error">Informe o horário real do retorno.</p>
          }
        }
        @if (data.mode === 'reason' || delayed) {
          <label class="dialog-field"
            >{{ delayed ? 'Observação do atraso' : 'Justificativa' }}
            <textarea rows="3" [formControl]="reason" (blur)="reason.markAsTouched()"></textarea>
          </label>
          @if (reason.touched && !reason.value.trim()) {
            <p class="field-error">Preencha a justificativa para continuar.</p>
          }
        }
        <p class="demo-note">Ação simulada. Nenhum dado institucional é enviado.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
        <button mat-flat-button type="button" (click)="confirm()">{{ data.action }}</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .review-dialog {
        max-width: 580px;
        min-width: min(520px, calc(100vw - 48px));
        color: var(--ink);
      }
      h2 {
        font-size: 1.4rem;
        font-weight: 700;
      }
      .review-list {
        margin: 8px 0 22px;
      }
      .review-list div {
        display: grid;
        grid-template-columns: minmax(110px, 35%) 1fr;
        gap: 12px;
        border-bottom: 1px solid var(--line);
        padding: 11px 0;
      }
      dt {
        color: var(--muted);
      }
      dd {
        margin: 0;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .dialog-field {
        display: grid;
        gap: 6px;
        font-weight: 700;
        margin: 15px 0;
      }
      .dialog-field input,
      .dialog-field textarea {
        font: inherit;
        font-weight: 400;
        color: var(--ink);
        border: 1px solid var(--field-border);
        border-radius: var(--radius-control);
        min-height: 48px;
        padding: 10px 14px;
        width: 100%;
        box-sizing: border-box;
      }
      .review-warning {
        color: var(--warning-ink);
        padding: 16px 18px;
        border-radius: 12px;
        background: var(--warning-bg);
      }
      .demo-note {
        color: var(--muted);
        font-size: 0.875rem;
      }
      mat-dialog-actions button {
        min-height: 48px;
      }
      @media (max-width: 540px) {
        .review-dialog {
          min-width: 0;
        }
        .review-list div {
          grid-template-columns: 1fr;
          gap: 3px;
        }
      }
    `,
  ],
})
export class OperationsReviewDialogComponent {
  readonly data = inject<ReviewDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<OperationsReviewDialogComponent, ReviewDialogResult>);
  readonly reason = new FormControl('', { nonNullable: true });
  readonly actualReturn = new FormControl(localDateTime(new Date()), {
    nonNullable: true,
    validators: [Validators.required],
  });

  get delayed(): boolean {
    return (
      this.data.mode === 'return' &&
      !!this.data.expectedReturn &&
      Date.parse(this.actualReturn.value) > Date.parse(this.data.expectedReturn)
    );
  }

  confirm(): void {
    if (this.data.mode === 'return' && this.actualReturn.invalid) {
      this.actualReturn.markAsTouched();
      return;
    }
    if ((this.data.mode === 'reason' || this.delayed) && !this.reason.value.trim()) {
      this.reason.markAsTouched();
      return;
    }
    this.dialogRef.close({
      reason: this.reason.value.trim(),
      actualReturn: this.data.mode === 'return' ? this.actualReturn.value : undefined,
    });
  }
}
