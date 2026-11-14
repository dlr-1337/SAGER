import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PaginationComponent } from './pagination.component';

@Component({
  standalone: true,
  imports: [PaginationComponent],
  template: `<h2 id="lista" tabindex="-1">Lista</h2>
    <sager-pagination
      [page]="page()"
      [total]="total()"
      [hasNext]="hasNext()"
      anchor="lista"
      (pageChange)="page.set($event)"
    />`,
})
class HostComponent {
  readonly page = signal(0);
  readonly total = signal(0);
  readonly hasNext = signal<boolean | null>(null);
}

function setup(values: { page?: number; total?: number; hasNext?: boolean | null }) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.page.set(values.page ?? 0);
  fixture.componentInstance.total.set(values.total ?? 0);
  fixture.componentInstance.hasNext.set(values.hasNext ?? null);
  fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('sager-pagination button')];
  return { fixture, element, buttons };
}

describe('Paginação compartilhada', () => {
  it('mostra início, fim e total quando o total é conhecido', () => {
    const { fixture, element, buttons } = setup({ page: 1, total: 60 });
    expect(element.textContent).toContain('26–50 de 60');
    expect(buttons().map((button) => button.disabled)).toEqual([false, false]);
    fixture.componentInstance.page.set(2);
    fixture.detectChanges();
    expect(element.textContent).toContain('51–60 de 60');
    expect(buttons()[1].disabled).toBe(true);
  });

  it('mostra "Página N" e habilita Próxima só com mais registros nas listas por cursor', () => {
    const { fixture, element, buttons } = setup({ page: 1, hasNext: false });
    expect(element.textContent).toContain('Página 2');
    expect(element.textContent).not.toContain(' de ');
    expect(buttons().map((button) => button.disabled)).toEqual([false, true]);
    fixture.componentInstance.hasNext.set(true);
    fixture.detectChanges();
    expect(buttons()[1].disabled).toBe(false);
  });

  it.each([
    { total: 25, hasNext: null },
    { total: 0, hasNext: null },
    { total: 0, hasNext: false },
  ])('some quando tudo cabe numa página ($total, $hasNext)', (values) => {
    const { element } = setup(values);
    expect(element.querySelector('sager-pagination nav')).toBeNull();
  });

  it('leva o foco ao título da lista ao trocar de página', () => {
    const { fixture, element, buttons } = setup({ total: 30 });
    buttons()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(1);
    expect(document.activeElement).toBe(element.querySelector('#lista'));
    expect(element.textContent).toContain('26–30 de 30');
  });
});
