import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Route,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes, SagerPreloading } from './app.routes';
import { resetSession } from './core/api';
import { DemoSessionService } from './core/demo-session.service';
import { LocalAuthService } from './core/local-auth.service';

const principal = (perfil: 'gestor' | 'residente') => ({
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Pessoa Exemplo',
  email: null,
  matricula: 'TESTE-ROTAS',
  fotoUrl: null,
  perfis: [perfil],
  residenteId: perfil === 'residente' ? '00000000-0000-0000-0000-000000000002' : null,
  supervisorId: null,
});

function allRoutes(list: Route[]): Route[] {
  return list.flatMap((route) => [route, ...allRoutes(route.children ?? [])]);
}

async function enter(path: string): Promise<string | boolean> {
  const route = routes.find((entry) => entry.path === path)!;
  const guard = route.canActivate![0] as CanActivateFn;
  const result = await TestBed.runInInjectionContext(() =>
    guard({ data: route.data ?? {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  return result instanceof UrlTree ? result.toString() : (result as boolean);
}

describe('accessGuard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetSession();
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('na conta, pergunta /auth/me só na primeira navegação', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(principal('gestor'))));
    expect(await enter('inicio')).toBe(true);
    expect(await enter('residentes')).toBe(true);
    expect(await enter('quartos')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/me');
  });

  it('nega a um residente conhecido a lista de residentes sem ir ao servidor', async () => {
    TestBed.inject(LocalAuthService).principal.set(principal('residente'));
    expect(await enter('residentes')).toBe('/acesso-negado');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem conta e sem demonstração, manda para /acesso', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    expect(await enter('inicio')).toBe('/acesso');
  });

  it('na demonstração, o gestor navega sem pedir nada ao servidor', async () => {
    TestBed.inject(DemoSessionService).activate('gestor');
    expect(TestBed.inject(LocalAuthService).principal()).toBeNull();
    for (const path of ['inicio', 'residentes', 'quartos']) expect(await enter(path)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('saídas do residente', () => {
    const requests = [
      'saidas/nova',
      'saidas/:id/editar',
      'saidas/longas/nova',
      'saidas/longas/:id/editar',
    ];
    const reading = ['saidas', 'saidas/:id', 'saidas/longas/:id'];

    it('leva o adulto ao acesso negado no pedido e na edição, e deixa a consulta aberta', async () => {
      TestBed.inject(LocalAuthService).principal.set({
        ...principal('residente'),
        maiorDeIdade: true,
      });
      for (const path of requests) expect(await enter(path)).toBe('/acesso-negado');
      for (const path of reading) expect(await enter(path)).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deixa o menor entrar nas sete rotas e o supervisor na lista', async () => {
      const auth = TestBed.inject(LocalAuthService);
      auth.principal.set({ ...principal('residente'), maiorDeIdade: false });
      for (const path of [...requests, ...reading]) expect(await enter(path)).toBe(true);
      auth.principal.set({ ...principal('gestor'), perfis: ['supervisor'] });
      expect(await enter('saidas')).toBe(true);
    });

    it('demonstração com perfil residente entra em saidas, saidas/nova e saidas/:id', async () => {
      const session = TestBed.inject(DemoSessionService);
      session.activate('residente');
      expect(session.active()).toBe(true);
      expect(TestBed.inject(LocalAuthService).principal()).toBeNull();
      for (const path of ['saidas', 'saidas/nova', 'saidas/:id'])
        expect(await enter(path)).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('na demonstração, o residente não abre a lista de residentes', async () => {
    TestBed.inject(DemoSessionService).activate('residente');
    expect(await enter('residentes')).toBe('/acesso-negado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SagerPreloading', () => {
  const strategy = new SagerPreloading();

  it('não carrega a rota marcada com preload: false', async () => {
    const load = vi.fn(() => of('carregada'));
    expect(await firstValueFrom(strategy.preload({ data: { preload: false } }, load))).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('carrega as demais rotas', async () => {
    const load = vi.fn(() => of('carregada'));
    expect(await firstValueFrom(strategy.preload({ path: 'quartos' }, load))).toBe('carregada');
    expect(await firstValueFrom(strategy.preload({ data: { roles: [] } }, load))).toBe('carregada');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('deixa fora do pré-carregamento só o relatório individual', () => {
    expect(
      allRoutes(routes)
        .filter((route) => route.data?.['preload'] === false)
        .map((route) => route.path),
    ).toEqual(['relatorios/individual/:id']);
  });
});
