import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterState } from '../core/filter-state';
import { FilterChip, FilterPanelComponent } from './filter-panel.component';

@Component({
  standalone: true,
  imports: [FilterPanelComponent],
  template: `<sager-filter-panel
    heading="Filtrar avaliações"
    [chips]="chips()"
    (remove)="removed.push($event)"
    (clear)="cleared = cleared + 1"
  >
    <label filterMain>Busca<input type="search" /></label>
    <label
      >Quarto<select
      ></select
    ></label>
  </sager-filter-panel>`,
})
class HostComponent {
  readonly chips = signal<FilterChip[]>([]);
  readonly removed: string[] = [];
  cleared = 0;
}

function setup(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 761px)' && width > 760,
  }));
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  return { fixture, element, details: element.querySelector('details') as HTMLDetailsElement };
}

describe('Painel de filtro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mantém a busca fora da área recolhível e os extras em "Mais filtros"', () => {
    const { element, details } = setup(1280);
    expect(element.querySelector('h2')?.textContent).toBe('Filtrar avaliações');
    expect(details.contains(element.querySelector('input[type=search]'))).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Mais filtros');
    expect(details.querySelector('select')).not.toBeNull();
  });

  it('abre fechado no computador e no celular', () => {
    expect(setup(1280).details.open).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(390).details.open).toBe(false);
  });

  it('volta fechado ao recriar a tela, sem gravar o estado do painel', () => {
    const { fixture, details } = setup(1280);
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    fixture.destroy();
    expect(setup(1280).details.open).toBe(false);
    const keys = [...TestBed.inject(FilterState).values.keys()];
    expect(keys.filter((key) => key.startsWith('filter-panel:'))).toEqual([]);
  });

  it('mostra os filtros ativos fora da área, remove um e limpa todos', () => {
    const { fixture, element, details } = setup(390);
    expect(element.textContent).not.toContain('Limpar filtros');
    fixture.componentInstance.chips.set([
      { key: 'roomId', label: 'Quarto', value: '101-A' },
      { key: 'status', label: 'Situação', value: 'Aprovada' },
    ]);
    fixture.detectChanges();
    const chips = [...element.querySelectorAll<HTMLButtonElement>('.filter-chips button')];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'Quarto: 101-A close',
      'Situação: Aprovada close',
    ]);
    expect(details.contains(chips[0])).toBe(false);
    expect(chips[0].getAttribute('aria-label')).toBe('Remover filtro Quarto');
    chips[0].click();
    expect(fixture.componentInstance.removed).toEqual(['roomId']);
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Limpar filtros')
      ?.click();
    expect(fixture.componentInstance.cleared).toBe(1);
  });
});
