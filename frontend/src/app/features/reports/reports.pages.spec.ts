import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ReportsPage } from './reports.pages';
import { DemoSessionService } from '../../core/demo-session.service';

describe('ReportsPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FormBuilder] });
    TestBed.inject(DemoSessionService).activate('gestor');
  });
  afterEach(() => TestBed.inject(DemoSessionService).deactivate());

  it('aplica filtros em conjunto e bloqueia período invertido', () => {
    const page = TestBed.runInInjectionContext(() => new ReportsPage());
    page.form.patchValue({
      type: 'saidas',
      resident: 'Ana Luísa Ribeiro',
      occurrence: 'Saída longa',
      status: 'Aprovada',
    });
    page.apply();
    expect(page.results().length).toBe(1);
    expect(page.results()[0].description).toContain('assinatura simulada');
    expect(page.active().map((filter) => filter.label)).toContain('Relatório: Saídas e retornos');
    expect(page.active().length).toBe(4);

    page.remove('type');
    expect(page.form.controls.type.value).toBe('todos');
    expect(page.active().length).toBe(3);

    page.compactFilters.set(true);
    page.optionalFiltersOpen.set(false);
    page.form.patchValue({ start: '2026-09-30', end: '2026-09-01' });
    page.apply();
    expect(page.dateError()).toBe(true);
    expect(page.optionalFiltersOpen()).toBe(true);
    expect(page.results().length).toBe(1);
  });
});
