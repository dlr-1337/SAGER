import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { shortExitPresentText } from './operations-local.utils';

/**
 * Aviso que abre uma vez depois do pedido de saída curta: o residente procura o supervisor na hora
 * de sair, e as 3 horas só contam do registro (short-exit-two-steps).
 */
@Component({
  standalone: true,
  selector: 'app-exit-sent-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Pedido enviado</h2>
    <mat-dialog-content>
      <p class="exit-sent-text">{{ text }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn op-primary" mat-dialog-close cdkFocusInitial>Entendi</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--ink);
      }
      /* O Material pinta o conteúdo de cinza; o aviso é a mensagem principal da janela. */
      .exit-sent-text {
        color: var(--ink);
        font-size: 1.125rem;
        font-weight: 600;
        line-height: 1.45;
        margin: 0;
      }
      mat-dialog-actions {
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px 24px;
      }
    `,
  ],
})
export class ExitSentDialogComponent {
  readonly text = shortExitPresentText;
}
