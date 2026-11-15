import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSession } from '../../core/api';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { LocalHomePage, msUntilNextMidnight } from './local-home.page';

const resident = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Residente Sintético',
  email: null,
  matricula: 'TESTE-LOGIN',
  fotoUrl: null,
  perfis: ['residente' as const],
  residenteId: '00000000-0000-0000-0000-000000000002',
  supervisorId: null,
};
const notice = 'Maiores de idade podem sair do IF até 23h e voltar a partir das 6h.';

function setup(principal: Parameters<LocalAuthService['principal']['set']>[0]) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  TestBed.inject(DemoSessionService).deactivate();
  const auth = TestBed.inject(LocalAuthService);
  auth.principal.set(principal);
  return auth;
}

describe('msUntilNextMidnight', () => {
  it('conta até a meia-noite de Brasília, não do fuso da máquina', () => {
    // 12:00 UTC = 09:00 em America/Sao_Paulo: faltam 15 horas.
    expect(msUntilNextMidnight(new Date('2026-10-17T12:00:00Z'))).toBe(15 * 3_600_000);
  });

  it('trata o último minuto e a própria meia-noite', () => {
    expect(msUntilNextMidnight(new Date('2026-10-17T23:59:00-03:00'))).toBe(60_000);
    expect(msUntilNextMidnight(new Date('2026-10-18T00:00:00-03:00'))).toBe(86_400_000);
  });
});

describe('LocalHomePage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mostra ao adulto o horário no lugar das saídas, e ao menor as saídas sem o horário', async () => {
    const auth = setup({ ...resident, maiorDeIdade: true });
    const fixture = TestBed.createComponent(LocalHomePage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Horário de saída e volta');
    expect(page.textContent).toContain(notice);
    expect(page.querySelector('a[href="/saidas"]')).toBeNull();
    expect(page.querySelectorAll('.actions')).toHaveLength(2);
    auth.principal.set({ ...resident, maiorDeIdade: false });
    await fixture.whenStable();
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();
    expect(page.textContent).not.toContain(notice);
  });

  for (const profile of ['gestor', 'supervisor', 'residente'] as const) {
    it(`no início do ${profile}, o cabeçalho tem um só parágrafo curto`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => undefined)),
      );
      setup({
        ...resident,
        perfis: [profile],
        residenteId: profile === 'residente' ? resident.residenteId : null,
      });
      const fixture = TestBed.createComponent(LocalHomePage);
      await fixture.whenStable();
      const paragraphs = (fixture.nativeElement as HTMLElement).querySelectorAll('main > header p');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].textContent!.trim().split(/\s+/).length).toBeLessThanOrEqual(20);
    });
  }

  it('aos 15 s consulta a conta e troca as saídas pelo horário quando o residente faz 18 anos', async () => {
    vi.useFakeTimers();
    resetSession();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ...resident, maiorDeIdade: true })),
    );
    vi.stubGlobal('fetch', fetchMock);
    setup({ ...resident, maiorDeIdade: false });
    const fixture = TestBed.createComponent(LocalHomePage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/me');
    expect((init.headers as Record<string, string>)['X-Sager-Auto-Refresh']).toBe('1');
    fixture.detectChanges();
    expect(page.textContent).toContain(notice);
    expect(page.querySelector('a[href="/saidas"]')).toBeNull();
  });

  it('o início do supervisor não consulta nada sozinho', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setup({ ...resident, perfis: ['supervisor'], residenteId: null });
    const fixture = TestBed.createComponent(LocalHomePage);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fixture.componentInstance.refresh).toBeNull();
  });
});
