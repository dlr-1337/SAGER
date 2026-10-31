import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { SupervisorApiService } from './supervisor-api.service';
import { SupervisorsComponent } from './supervisors.component';

describe('Paginação autorizada de supervisores', () => {
  const records = Array.from({ length: 28 }, (_, index) => ({
    id: `supervisor-${index + 1}`,
    name: `Supervisor ${index + 1}`,
    institutionalId: `TESTE-${index + 1}`,
    email: `supervisor${index + 1}@example.invalid`,
    version: 0,
  }));

  it.each([
    { role: 'gestor', demo: false },
    { role: 'gestor', demo: true },
  ])('permite avançar de 25 para três registros ($role, demo=$demo)', async ({ role, demo }) => {
    const page = vi.fn(async (params: Record<string, string>) => ({
      items: records.slice(Number(params['offset']), Number(params['offset']) + 25),
      total: 28,
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupervisorApiService, useValue: { page } },
        { provide: ManagementDemoService, useValue: { supervisors: signal(records) } },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(demo),
            scenario: signal('padrao'),
            hasRole: (...roles: string[]) => roles.includes(role),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SupervisorsComponent);
    await fixture.whenStable();
    const names = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('article h3') as NodeListOf<HTMLElement>,
      ).map((heading) => heading.textContent?.trim());
    expect(names()).toEqual(records.slice(0, 25).map((item) => item.name));
    const next: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'sager-pagination button:last-of-type',
    );
    expect(next).not.toBeNull();
    next!.click();
    await fixture.whenStable();
    expect(names()).toEqual(records.slice(25).map((item) => item.name));
    expect(fixture.nativeElement.textContent).toContain('26–28 de 28');
    expect(next!.disabled).toBe(true);
    if (demo) expect(page).not.toHaveBeenCalled();
    else expect(page).toHaveBeenLastCalledWith({ search: '', limit: '25', offset: '25' });
  });

  it.each([{ demo: true }, { demo: false }])(
    'mantém o clique em Próxima dado logo depois de filtrar (demo=$demo)',
    async ({ demo }) => {
      const page = vi.fn(async (params: Record<string, string>) => ({
        items: records.slice(Number(params['offset']), Number(params['offset']) + 25),
        total: 28,
      }));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: SupervisorApiService, useValue: { page } },
          { provide: ManagementDemoService, useValue: { supervisors: signal(records) } },
          {
            provide: DemoSessionService,
            useValue: {
              active: signal(demo),
              scenario: signal('padrao'),
              hasRole: (...roles: string[]) => roles.includes('gestor'),
            },
          },
        ],
      });
      const fixture = TestBed.createComponent(SupervisorsComponent);
      await fixture.whenStable();
      fixture.componentInstance.changePage(1);
      fixture.componentInstance.search.setValue('Supervisor');
      expect(fixture.componentInstance.page()).toBe(0);
      fixture.componentInstance.changePage(1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(fixture.componentInstance.page()).toBe(1);
      if (!demo) {
        expect(page).toHaveBeenLastCalledWith({
          search: 'Supervisor',
          limit: '25',
          offset: '25',
        });
      }
    },
  );

  it('não oferece paginação nem consulta a API ao supervisor', async () => {
    const page = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupervisorApiService, useValue: { page } },
        { provide: ManagementDemoService, useValue: { supervisors: signal([]) } },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            scenario: signal('padrao'),
            hasRole: (...roles: string[]) => roles.includes('supervisor'),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SupervisorsComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Acesso restrito');
    expect(fixture.nativeElement.querySelector('sager-pagination')).toBeNull();
    expect(page).not.toHaveBeenCalled();
  });
});
