import { Component, input, output } from '@angular/core';

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

/**
 * Painel de filtro das listas longas: busca sempre visível, demais filtros em "Mais filtros"
 * (fechado toda vez que a tela abre, sem memória) e filtros ativos sempre à vista.
 */
@Component({
  selector: 'sager-filter-panel',
  standalone: true,
  template: `<section class="panel filter-panel" [attr.aria-label]="heading()">
    <h2>{{ heading() }}</h2>
    <ng-content select="[filterMain]" />
    <details>
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
export class FilterPanelComponent {
  readonly heading = input.required<string>();
  /** Sem uso desde que o painel deixou de lembrar o estado; sai quando as telas pararem de passar. */
  readonly key = input<string>();
  readonly chips = input<FilterChip[]>([]);
  readonly remove = output<string>();
  readonly clear = output<void>();
}
