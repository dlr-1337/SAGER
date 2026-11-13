import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService } from '../management/resident-api.service';
import { CommunicationsLocalApiService } from './communications-local-api.service';
import { NoticesManagementLocalPage } from './notices-local.pages';
import { NotificationsLocalPage } from './notifications-local.pages';
import { OwnCommunicationsLocalPage } from './own-communications-local.pages';
import { RecurrenceLocalPage } from './recurrence-local.pages';
import { WarningsLocalPage } from './warnings-local.pages';

type Filtered =
  | NoticesManagementLocalPage
  | WarningsLocalPage
  | OwnCommunicationsLocalPage
  | NotificationsLocalPage;
type Page = { items: { id: string }[]; nextCursor: number | null };
const first: Page = { items: [{ id: 'primeira' }], nextCursor: 10 };
const second: Page = { items: [{ id: 'segunda' }], nextCursor: null };
const residentId = '00000000-0000-0000-0000-000000000041';

function setup() {
  const page = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ id: residentId }),
            queryParamMap: convertToParamMap({}),
          },
        },
      },
      {
        provide: CommunicationsLocalApiService,
        useValue: {
          notices: page,
          warnings: page,
          ownList: page,
          notifications: page,
          terms: page,
          recurrences: vi.fn().mockResolvedValue([]),
        },
      },
      {
        provide: ResidentApiService,
        useValue: { list: vi.fn().mockResolvedValue([]), get: vi.fn().mockResolvedValue({}) },
      },
      { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
    ],
  });
  return page;
}

for (const component of [
  NoticesManagementLocalPage,
  WarningsLocalPage,
  OwnCommunicationsLocalPage,
  NotificationsLocalPage,
]) {
  describe(`Páginas fixas de ${component.name}`, () => {
    it('Próxima substitui a página e Anterior devolve a já vista sem nova consulta', async () => {
      const page = setup();
      const Component: Type<Filtered> = component;
      const view = TestBed.runInInjectionContext(() => new Component());
      expect(page).not.toHaveBeenCalled();
      await view.filter({ search: 'busca', residentId, status: 'PENDENTE' });
      expect(view.list.items()).toEqual(first.items);
      expect(view.list.hasNext()).toBe(true);
      await view.list.go(1);
      expect(view.list.items()).toEqual(second.items);
      expect(view.list.page()).toBe(1);
      expect(view.list.hasNext()).toBe(false);
      expect(page.mock.calls[1]).toContain(10);
      expect(page.mock.calls[1].at(-1)).toEqual({
        search: 'busca',
        residentId,
        status: 'PENDENTE',
      });
      if (component === WarningsLocalPage || component === NotificationsLocalPage)
        expect(page.mock.calls[1][0]).toBe(residentId);
      await view.list.go(0);
      expect(view.list.items()).toEqual(first.items);
      expect(page).toHaveBeenCalledTimes(2);
    });
  });
}

describe('Páginas fixas dos termos já emitidos', () => {
  it('Próxima usa o cursor e Anterior não consulta de novo', async () => {
    const page = setup();
    const view = TestBed.runInInjectionContext(() => new RecurrenceLocalPage());
    await vi.waitFor(() => expect(view.terms.items()).toEqual(first.items));
    await view.terms.go(1);
    expect(page).toHaveBeenLastCalledWith(residentId, 10);
    expect(view.terms.items()).toEqual(second.items);
    await view.terms.go(0);
    expect(view.terms.items()).toEqual(first.items);
    expect(page).toHaveBeenCalledTimes(2);
  });
});
