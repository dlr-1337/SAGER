import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { LocalHomePage, msUntilNextMidnight } from './local-home.page';

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
  it('mostra ao adulto o horário no lugar das saídas, e ao menor as saídas sem o horário', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    const auth = TestBed.inject(LocalAuthService);
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
    const notice = 'Maiores de idade podem sair do IF até 23h e devem voltar até 5h.';
    auth.principal.set({ ...resident, maiorDeIdade: true });
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
});
