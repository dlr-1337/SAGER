import { Component, input, output } from '@angular/core';
@Component({
  selector: 'sager-pagination',
  standalone: true,
  template: ` <nav class="action-row pagination" aria-label="Paginação">
    <button
      type="button"
      class="btn mg-secondary"
      [disabled]="busy() || page() === 0"
      (click)="pageChange.emit(page() - 1)"
    >
      Anterior
    </button>
    <span aria-live="polite">{{ total() ? page() * 25 + 1 : 0 }}–{{ end() }} de {{ total() }}</span>
    <button
      type="button"
      class="btn mg-secondary"
      [disabled]="busy() || (page() + 1) * 25 >= total()"
      (click)="pageChange.emit(page() + 1)"
    >
      Próxima
    </button>
  </nav>`,
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
  readonly busy = input(false);
  readonly pageChange = output<number>();
  end(): number {
    return Math.min((this.page() + 1) * 25, this.total());
  }
}
