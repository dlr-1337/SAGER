import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ReportsLocalApiService } from './reports-local-api.service';
import { ReportSnapshotLocalPage, ReportsLocalPage } from './reports-local.pages';

describe('Linhas do relatório gerado', () => {
  it('só muda de página depois que as linhas dela chegam', async () => {
    const rows = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ n: 1 }], total: 60 })
      .mockRejectedValueOnce(new Error('Falha sintética'))
      .mockResolvedValueOnce({ items: [{ n: 26 }], total: 60 });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'relatorio-teste' }) } },
        },
        { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
        {
          provide: ReportsLocalApiService,
          useValue: {
            get: vi.fn().mockResolvedValue({ rowCount: 60 }),
            rows,
            list: async () => [],
          },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new ReportSnapshotLocalPage());
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    await page.go(1);
    expect(page.page()).toBe(0);
    expect(page.rows()).toEqual([{ n: 1 }]);
    expect(page.rowsError()).not.toBe('');
    await page.go(1);
    expect(page.page()).toBe(1);
    expect(page.rows()).toEqual([{ n: 26 }]);
    page.ngOnDestroy();
  });
});

describe('Tela de relatórios', () => {
  it('tem uma frase no cabeçalho e o aviso comum da atualização automática', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: DemoSessionService,
          useValue: { active: signal(false), scenario: signal('padrao'), hasRole: () => true },
        },
        {
          provide: ReportsLocalApiService,
          useValue: {
            catalog: vi
              .fn()
              .mockResolvedValue({ items: [], maxPeriodDays: 366, expiresAfterHours: 24 }),
            currentDate: vi.fn().mockResolvedValue('2026-11-14'),
            filterOptions: vi.fn().mockResolvedValue({
              housing: { accommodations: [], units: [], rooms: [] },
              residents: [],
              failed: false,
            }),
            list: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ReportsLocalPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.op-heading p')).toHaveLength(1);
    expect(root.querySelector('.op-heading p')?.textContent).toContain('Gerar relatório');
    expect(root.querySelector('sager-auto-refresh-status [role=status]')).toBeTruthy();
    fixture.destroy();
  });
});
