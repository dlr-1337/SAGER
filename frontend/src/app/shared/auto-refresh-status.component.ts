import { Component, input } from '@angular/core';
import type { AutoRefresh } from '../core/auto-refresh';

/**
 * Aviso comum da atualização automática, perto do título: pausa com "Retomar" ou falha discreta.
 * A região `role="status"` fica sempre na página para o leitor de tela anunciar a mudança.
 */
@Component({
  selector: 'sager-auto-refresh-status',
  standalone: true,
  template: `<div role="status">
    @if (refresh().state() === 'paused') {
      <p>
        Atualização pausada
        <button class="btn-secondary" type="button" (click)="refresh().resume()">Retomar</button>
      </p>
    } @else if (refresh().failed()) {
      <p>Não foi possível atualizar. A tela tenta de novo sozinha.</p>
    }
  </div>`,
  styles: `
    p {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      margin: 0 0 var(--space-4);
      color: var(--muted);
      font-weight: 600;
    }
  `,
})
export class AutoRefreshStatusComponent {
  readonly refresh = input.required<Pick<AutoRefresh, 'state' | 'failed' | 'resume'>>();
}
