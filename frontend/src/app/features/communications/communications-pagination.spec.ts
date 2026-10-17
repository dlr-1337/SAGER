import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService } from '../management/resident-api.service';
import { CommunicationsLocalApiService } from './communications-local-api.service';
import { NoticesManagementLocalPage } from './notices-local.pages';
import { NotificationsLocalPage } from './notifications-local.pages';
import { OwnCommunicationsLocalPage } from './own-communications-local.pages';
import { WarningsLocalPage } from './warnings-local.pages';

type List =
  | NoticesManagementLocalPage
  | WarningsLocalPage
  | OwnCommunicationsLocalPage
  | NotificationsLocalPage;
type Page = { items: { id: string }[]; nextCursor: number | null };
const initial: Page = { items: [{ id: 'inicial' }], nextCursor: 10 };
const current: Page = { items: [{ id: 'atual' }], nextCursor: 20 };
function pendingPage() {
  let resolve!: (page: Page) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Page>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

for (const component of [
  NoticesManagementLocalPage,
  WarningsLocalPage,
  OwnCommunicationsLocalPage,
  NotificationsLocalPage,
]) {
  describe(`Paginação substituída de ${component.name}`, () => {
    async function setup() {
      const page = vi.fn().mockResolvedValue(initial);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: CommunicationsLocalApiService,
            useValue: { notices: page, warnings: page, ownList: page, notifications: page },
          },
          { provide: ResidentApiService, useValue: { list: vi.fn().mockResolvedValue([]) } },
          { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
        ],
      });
      const Component: Type<List> = component;
      const list = TestBed.runInInjectionContext(() => new Component());
      await list.load();
      page.mockClear();
      return { list, page };
    }

    it.each(['success', 'failure'])(
      'ignora conclusão antiga (%s) após a nova busca terminar',
      async (result) => {
        const { list, page } = await setup();
        const old = pendingPage();
        page.mockReturnValueOnce(old.promise).mockResolvedValueOnce(current);
        const oldMore = list.more();
        list.searchFilters = { search: 'busca atual' };
        await list.load();
        expect(list.moreLoading()).toBe(false);
        if (result === 'failure') old.reject(new Error('Falha antiga'));
        else old.resolve({ items: [{ id: 'descartado' }], nextCursor: 30 });
        await oldMore;
        expect(list.items()).toEqual(current.items);
        expect(list.nextCursor()).toBe(20);
        expect(list.moreError()).toBe('');
        expect(page.mock.calls.at(-1)?.at(-1)).toEqual({ search: 'busca atual' });
      },
    );

    it.each(['success', 'failure'])(
      'conclusão antiga (%s) não encerra uma nova paginação pendente',
      async (result) => {
        const { list, page } = await setup();
        const old = pendingPage();
        const latest = pendingPage();
        page
          .mockReturnValueOnce(old.promise)
          .mockResolvedValueOnce(current)
          .mockReturnValueOnce(latest.promise);
        const oldMore = list.more();
        list.searchFilters = { search: 'busca atual' };
        await list.load();
        const newMore = list.more();
        expect(page).toHaveBeenCalledTimes(3);
        if (result === 'failure') old.reject(new Error('Falha antiga'));
        else old.resolve({ items: [{ id: 'descartado' }], nextCursor: null });
        await oldMore;
        expect(list.moreLoading()).toBe(true);
        expect(list.moreError()).toBe('');
        expect(list.items()).toEqual(current.items);
        latest.resolve({ items: [...current.items, { id: 'seguinte' }], nextCursor: null });
        await newMore;
        expect(list.items()).toEqual([{ id: 'atual' }, { id: 'seguinte' }]);
        expect(list.moreLoading()).toBe(false);
        expect(list.nextCursor()).toBeNull();
      },
    );

    it('apresenta falha atual, mantém os itens e permite tentar novamente', async () => {
      const { list, page } = await setup();
      page
        .mockRejectedValueOnce(new Error('Falha atual'))
        .mockResolvedValueOnce({ items: [{ id: 'seguinte' }], nextCursor: null });
      await list.more();
      expect(list.items()).toEqual(initial.items);
      expect(list.nextCursor()).toBe(10);
      expect(list.moreLoading()).toBe(false);
      expect(list.moreError()).not.toBe('');
      await list.more();
      expect(list.items()).toEqual([...initial.items, { id: 'seguinte' }]);
      expect(list.moreError()).toBe('');
    });
  });
}
