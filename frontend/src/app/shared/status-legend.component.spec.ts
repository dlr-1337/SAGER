import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatusLegendComponent } from './status-legend.component';

function render(names: string[]) {
  const fixture = TestBed.createComponent(StatusLegendComponent);
  fixture.componentRef.setInput('names', names);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Legenda de situação', () => {
  it('começa fechada, com o resumo da pergunta', () => {
    const details = render(['Aprovada']).querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('O que significa cada cor?');
  });

  it('mostra uma linha por nome, com a etiqueta no tom do mapa e o mesmo texto', () => {
    const element = render(['Aguardando análise', 'Rejeitada', 'Expirada', 'Sem entrada']);
    const rows = [...element.querySelectorAll('dl > div')];
    expect(rows).toHaveLength(4);
    const tags = rows.map((row) => row.querySelector('dt .status') as HTMLElement);
    expect(tags.map((tag) => tag.textContent?.trim())).toEqual([
      'Aguardando análise',
      'Rejeitada',
      'Expirada',
      'Sem entrada',
    ]);
    expect(tags.map((tag) => tag.getAttribute('data-tone'))).toEqual([
      'warning',
      'danger',
      null,
      null,
    ]);
    expect(rows[0].querySelector('dd')?.textContent).toBe('Espera a decisão do supervisor.');
  });
});
