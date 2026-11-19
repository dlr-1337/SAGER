import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pendingLabel } from '../core/pending-badges.service';

/**
 * Contador do que espera ação ou leitura (pending-badges). Mostra o número, ou "99+", num selo âmbar
 * com borda; o leitor de tela lê ", N pendentes" junto do nome do link ou da aba. Com zero, não
 * desenha nada. `announce` falso deixa só o selo, para o botão "Menu", que lê a soma como descrição.
 */
@Component({
  selector: 'sager-pending-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (count() > 0) {
      <span class="pending-badge" aria-hidden="true">{{ shown() }}</span>
      @if (announce()) {
        <span class="sr-only">, {{ label() }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
    /* Sem número, o elemento some: não ocupa o espaço entre os itens do link. */
    :host:empty {
      display: none;
    }
    .pending-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      min-width: 26px;
      height: 26px;
      padding: 0 7px;
      border: 1px solid var(--warning-mark);
      border-radius: 999px;
      background: var(--warning-bg);
      color: var(--warning-ink);
      font-size: var(--text-meta);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    @media (forced-colors: active) {
      .pending-badge {
        border-color: CanvasText;
      }
    }
  `,
})
export class PendingBadgeComponent {
  readonly count = input.required<number>();
  readonly announce = input(true);
  readonly shown = computed(() => (this.count() > 99 ? '99+' : String(this.count())));
  readonly label = computed(() => pendingLabel(this.count()));
}
