import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../core/session.service';
import { FilterState } from '../../core/filter-state';
import { AccommodationApiService } from './accommodation-api.service';
import { AccommodationsComponent } from './accommodations.component';
import { GuardianApiService } from './guardian-api.service';
import { GuardiansPage } from './guardians.pages';
import { ResidentApiService } from './resident-api.service';
import { SupervisorApiService } from './supervisor-api.service';
import { SupervisorsComponent } from './supervisors.component';

type List = SupervisorsComponent | GuardiansPage | AccommodationsComponent;
const records = Array.from({ length: 55 }, (_, index) => ({
  id: `registro-${index + 1}`,
  name: `Registro Sintético ${index + 1}`,
  code: `A-${index + 1}`,
  institutionalId: `TESTE-${index + 1}`,
  email: 'teste@example.invalid',
  residentId: 'residente-teste',
  relationship: 'Mãe',
  phone: null,
  active: true,
  version: 0,
}));

for (const config of [
  { component: SupervisorsComponent, key: 'supervisors', pageKey: 'supervisors.component.ts-page' },
  { component: GuardiansPage, key: 'guardians', pageKey: 'guardians.pages.ts-page' },
  {
    component: AccommodationsComponent,
    key: 'accommodations',
    pageKey: 'accommodations.component.ts-page',
  },
]) {
  describe(`Página restaurada de ${config.key}`, () => {
    function setup(page: ReturnType<typeof vi.fn>, initialPage = 1) {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: SupervisorApiService, useValue: { page } },
          { provide: GuardianApiService, useValue: { page } },
          { provide: AccommodationApiService, useValue: { page } },
          {
            provide: ResidentApiService,
            useValue: {
              list: vi
                .fn()
                .mockResolvedValue([
                  { id: 'residente-teste', name: 'Residente Sintético', enrollment: 'TESTE-001' },
                ]),
            },
          },
          {
            provide: SessionService,
            useValue: { active: signal(false), scenario: signal('padrao'), hasRole: () => true },
          },
        ],
      });
      const memory = TestBed.inject(FilterState);
      memory.values.set(config.pageKey, initialPage);
      memory.values.set(config.key, 'Sintético');
      memory.values.set('guardian-active', 'true');
      memory.values.set('guardian-resident', 'residente-teste');
      const component: Type<List> = config.component;
      return TestBed.createComponent(component);
    }

    it.each([
      { total: 25, initialPage: 1, expectedPage: 0, requests: 2 },
      { total: 0, initialPage: 1, expectedPage: 0, requests: 2 },
      { total: 26, initialPage: 1, expectedPage: 1, requests: 1 },
      { total: 55, initialPage: 4, expectedPage: 2, requests: 2 },
    ])('limita a página $initialPage ao total $total sem perder os filtros', async (scenario) => {
      const page = vi.fn(async (params: Record<string, string>) => ({
        items: records
          .slice(0, scenario.total)
          .slice(Number(params['offset']), Number(params['offset']) + 25),
        total: scenario.total,
      }));
      const fixture = setup(page, scenario.initialPage);
      await fixture.whenStable();
      const list = fixture.componentInstance;
      expect(list.page()).toBe(scenario.expectedPage);
      expect(list.paged()).toEqual(
        records
          .slice(0, scenario.total)
          .slice(scenario.expectedPage * 25, (scenario.expectedPage + 1) * 25),
      );
      expect(list.total()).toBe(scenario.total);
      expect(list.loading()).toBe(false);
      expect(page).toHaveBeenCalledTimes(scenario.requests);
      expect(page).toHaveBeenLastCalledWith({
        search: 'Sintético',
        limit: '25',
        offset: String(scenario.expectedPage * 25),
        ...(config.key === 'guardians' ? { active: 'true', residentId: 'residente-teste' } : {}),
      });
      expect(TestBed.inject(FilterState).values.get(config.pageKey)).toBe(scenario.expectedPage);
      if (scenario.total === 25) expect(fixture.nativeElement.textContent).toContain('1–25 de 25');
    });

    it('ignora o total de uma resposta antiga sem corrigir a página atual', async () => {
      let finish!: (value: { items: typeof records; total: number }) => void;
      const page = vi
        .fn()
        .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
        .mockResolvedValueOnce({ items: records.slice(25, 26), total: 26 });
      const fixture = setup(page);
      await fixture.componentInstance.load();
      finish({ items: [], total: 0 });
      await fixture.whenStable();
      expect(fixture.componentInstance.page()).toBe(1);
      expect(fixture.componentInstance.total()).toBe(26);
      expect(fixture.componentInstance.paged()).toEqual(records.slice(25, 26));
      expect(page).toHaveBeenCalledTimes(2);
    });
  });
}
