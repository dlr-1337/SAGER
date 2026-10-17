import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationFiltersComponent } from './communication-filters.component';

describe('Estados dos filtros de comunicação', () => {
  it.each([
    { mode: 'warnings', statuses: ['VIGENTE', 'ANULADA'] },
    { mode: 'notices', statuses: ['RASCUNHO', 'PUBLICADO', 'RETIRADO'] },
    { mode: 'own', statuses: ['PUBLICADO', 'RETIRADO', 'SUPERADO', 'ANULADO'] },
  ] as const)('oferece e emite os estados da API em $mode', async ({ mode, statuses }) => {
    const fixture = TestBed.createComponent(CommunicationFiltersComponent);
    fixture.componentRef.setInput('mode', mode);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    await fixture.whenStable();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      'select[formControlName=status]',
    );
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', ...statuses]);
    for (const status of statuses) {
      select.value = status;
      select.dispatchEvent(new Event('change'));
      fixture.componentInstance.apply();
      expect(changed).toHaveBeenLastCalledWith({ status });
    }
  });

  it('mantém a situação das notificações no controle específico da página', async () => {
    const fixture = TestBed.createComponent(CommunicationFiltersComponent);
    fixture.componentRef.setInput('mode', 'notifications');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select[formControlName=status]')).toBeNull();
  });
});
