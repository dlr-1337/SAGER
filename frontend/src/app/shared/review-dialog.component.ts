import { Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';

export interface ReviewItem {
  label: string;
  value: string;
}

export interface ReviewDialogData {
  title: string;
  summary: string;
  items?: ReviewItem[];
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-review-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="summary">{{ data.summary }}</p>
      @if (data.items?.length) {
        <dl>
          @for (item of data.items; track item.label) {
            <div><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
          }
        </dl>
      }
      @if (data.warning) { <p class="warning"><span class="material-symbols-rounded" aria-hidden="true">info</span>{{ data.warning }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn-secondary" (click)="close(false)">{{ data.cancelLabel || 'Cancelar' }}</button>
      <button type="button" class="btn" [class.danger]="data.danger" (click)="close(true)">{{ data.confirmLabel || 'Confirmar' }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; padding: 5px 7px; }
    h2 { color: var(--ink); font-size: 1.43rem; font-weight: 800; }
    .summary { color: var(--ink); margin: 0 0 16px; }
    dl { margin: 0; border-block: 1px solid var(--line); }
    dl > div { display: grid; grid-template-columns: minmax(125px, 38%) 1fr; gap: 12px; padding: 10px 0; }
    dl > div + div { border-top: 1px solid var(--line); }
    dt { color: var(--muted); }
    dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
    .warning { display: flex; gap: 9px; align-items: flex-start; margin: 16px 0 0; color: var(--warning); background: var(--warning-bg); padding: 12px; border-radius: 8px; }
    .warning .material-symbols-rounded { flex: 0 0 auto; }
    mat-dialog-actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 16px 0 8px; }
    .danger { background: var(--danger); border-color: var(--danger); }
    .danger:hover { background: #831923; border-color: #831923; }
    @media (max-width: 500px) { dl > div { grid-template-columns: 1fr; gap: 0; } mat-dialog-actions button { flex: 1 1 140px; } }
  `],
})
export class ReviewDialogComponent {
  readonly data = inject<ReviewDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ReviewDialogComponent, boolean>);

  close(confirmed: boolean): void {
    this.ref.close(confirmed);
  }
}

@Injectable({ providedIn: 'root' })
export class ReviewDialogService {
  private readonly dialog = inject(MatDialog);

  open(data: ReviewDialogData): Observable<boolean | undefined> {
    return this.dialog.open<ReviewDialogComponent, ReviewDialogData, boolean>(ReviewDialogComponent, {
      data,
      width: '540px',
      maxWidth: 'calc(100vw - 24px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      role: 'alertdialog',
    }).afterClosed();
  }
}
