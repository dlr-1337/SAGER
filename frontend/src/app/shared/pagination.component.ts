import { Component, computed, input, output } from '@angular/core';
@Component({
  selector: 'sager-pagination',
  standalone: true,
  template: `@if (visible()) {
    <nav class="action-row pagination" aria-label="Paginação">
      <button
        type="button"
        class="btn mg-secondary"
        [disabled]="busy() || page() === 0"
        (click)="go(page() - 1)"
      >
        Anterior
      </button>
      <span aria-live="polite">{{
        hasNext() === null
          ? (total() ? page() * size() + 1 : 0) + '–' + end() + ' de ' + total()
          : 'Página ' + (page() + 1)
      }}</span>
      <button
        type="button"
        class="btn mg-secondary"
        [disabled]="busy() || !next()"
        (click)="go(page() + 1)"
      >
        Próxima
      </button>
    </nav>
  }`,
  styles: [
    `
      .pagination {
        justify-content: flex-end;
        flex-wrap: wrap;
        margin: 20px 0;
      }
      .pagination span {
        align-self: center;
      }
    `,
  ],
})
export class PaginationComponent {
  readonly page = input(0);
  readonly total = input(0);
  readonly size = input(25);
  /** Sem total (listas por cursor): mostra "Página N" e habilita Próxima por este valor. */
  readonly hasNext = input<boolean | null>(null);
  /** Id do título da lista, que recebe o foco depois da troca de página. */
  readonly anchor = input<string>();
  readonly busy = input(false);
  readonly pageChange = output<number>();
  readonly next = computed(() => this.hasNext() ?? (this.page() + 1) * this.size() < this.total());
  readonly visible = computed(() => this.page() > 0 || this.next());
  end(): number {
    return Math.min((this.page() + 1) * this.size(), this.total());
  }
  go(page: number): void {
    this.pageChange.emit(page);
    const anchor = this.anchor();
    const target = anchor ? document.getElementById(anchor) : null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'start' });
  }
}
