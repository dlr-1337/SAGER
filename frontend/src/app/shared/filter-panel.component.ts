import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FilterState } from '../core/filter-state';

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

/**
 * Painel de filtro das listas longas: busca sempre visível, demais filtros em "Mais filtros"
 * (aberto acima de 760 px, lembrado por tela na sessão) e filtros ativos sempre à vista.
 */
@Component({
  selector: 'sager-filter-panel',
  standalone: true,
  template: `<section class="panel filter-panel" [attr.aria-label]="heading()">
    <h2>{{ heading() }}</h2>
    <ng-content select="[filterMain]" />
    <details [open]="open()" (toggle)="toggled($event)">
      <summary>Mais filtros</summary>
      <div class="filter-panel-extra"><ng-content /></div>
    </details>
    @if (chips().length) {
      <div class="filter-panel-active">
        <ul class="filter-chips" aria-label="Filtros aplicados">
          @for (chip of chips(); track chip.key) {
            <li>
              <button
                type="button"
                [attr.aria-label]="'Remover filtro ' + chip.label"
                (click)="remove.emit(chip.key)"
              >
                {{ chip.label }}: {{ chip.value }}
                <span class="material-symbols-rounded" aria-hidden="true">close</span>
              </button>
            </li>
          }
        </ul>
        <button class="btn-secondary" type="button" (click)="clear.emit()">Limpar filtros</button>
      </div>
    }
  </section>`,
})
export class FilterPanelComponent implements OnInit {
  readonly heading = input.required<string>();
  readonly key = input.required<string>();
  readonly chips = input<FilterChip[]>([]);
  readonly remove = output<string>();
  readonly clear = output<void>();
  private readonly state = inject(FilterState);
  readonly open = signal(false);
  ngOnInit(): void {
    const remembered = this.state.values.get(this.memoryKey());
    this.open.set(
      typeof remembered === 'boolean'
        ? remembered
        : typeof matchMedia === 'function' && matchMedia('(min-width: 761px)').matches,
    );
  }
  toggled(event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;
    this.open.set(open);
    this.state.values.set(this.memoryKey(), open);
  }
  private memoryKey(): string {
    return 'filter-panel:' + this.key();
  }
}
