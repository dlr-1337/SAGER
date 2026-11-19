import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import {
  PendingBadgesService,
  type PendingCounts,
  type PendingKey,
} from '../../core/pending-badges.service';
import { ResidentApiService } from '../management/resident-api.service';
import { CommunicationsLocalApiService } from './communications-local-api.service';
import { OwnCommunicationsLocalPage } from './own-communications-local.pages';

describe('Abas de Minhas comunicações', () => {
  it('mostram quantos avisos, advertências e termos estão sem ciência', async () => {
    const counts = signal<PendingCounts>({ notices: 1, warnings: 3, terms: 0 });
    TestBed.configureTestingModule({
      imports: [OwnCommunicationsLocalPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: CommunicationsLocalApiService,
          useValue: { ownList: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
        },
        { provide: ResidentApiService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        {
          provide: DemoSessionService,
          useValue: {
            active: signal(false),
            hasRole: (...roles: string[]) => roles.includes('residente'),
          },
        },
        {
          provide: PendingBadgesService,
          useValue: {
            count: (keys: readonly PendingKey[]) =>
              keys.reduce((total, key) => total + (counts()[key] ?? 0), 0),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(OwnCommunicationsLocalPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tabs = [...element.querySelectorAll<HTMLButtonElement>('.comm-tabs button')];
    const badges = () =>
      tabs.map((tab) => tab.querySelector('.pending-badge')?.textContent?.trim() ?? null);
    expect(tabs.map((tab) => tab.firstChild?.textContent?.trim())).toEqual([
      'Avisos',
      'Advertências',
      'Termos de compromisso',
    ]);
    expect(badges()).toEqual(['1', '3', null]);
    expect(tabs[0].querySelector('.sr-only')?.textContent).toBe(', 1 pendente');
    expect(tabs[1].querySelector('.sr-only')?.textContent).toBe(', 3 pendentes');

    counts.set({ notices: 0, warnings: 3, terms: 1 });
    fixture.detectChanges();
    expect(badges()).toEqual([null, '3', '1']);
    fixture.destroy();
  });
});
