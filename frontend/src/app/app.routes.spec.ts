import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';
import { SessionService } from './core/session.service';
import { LocalAuthService } from './core/local-auth.service';
import { HealthApiService } from './features/health/health-api.service';
import { HealthCapabilities, ProfessionalGrant } from './features/health/health.models';

describe('Rotas de saúde locais', () => {
  const session = { active: vi.fn(() => false) };
  const auth = { refresh: vi.fn(), clearPrincipal: vi.fn() };
  const api = { getMe: vi.fn() };
  const capabilities: HealthCapabilities = {
    professionalGrant: { id: 'grant-current' } as ProfessionalGrant,
    canAdministerAccess: false,
    canAccessOwnRecord: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    session.active.mockReturnValue(false);
    auth.refresh.mockResolvedValue({ perfis: ['saude'] });
    api.getMe.mockReturnValue(of(capabilities));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: SessionService, useValue: session },
        { provide: LocalAuthService, useValue: auth },
        { provide: HealthApiService, useValue: api },
      ],
    });
  });

  async function enter(path: string): Promise<string | boolean> {
    const route = routes.find((entry) => entry.path === path)!;
    const guard = route.canActivate![0] as CanActivateFn;
    const result = await TestBed.runInInjectionContext(() =>
      guard({ data: route.data } as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return result instanceof UrlTree ? result.toString() : (result as boolean);
  }

  it('confere novamente habilitação e sessão ao voltar para uma nota após revogação', async () => {
    expect(await enter('saude/notas/:id')).toBe(true);
    api.getMe.mockReturnValue(of({ ...capabilities, professionalGrant: null }));
    expect(await enter('saude/notas/:id')).toBe('/acesso-negado');
    expect(auth.refresh).toHaveBeenCalledTimes(2);
    expect(api.getMe).toHaveBeenCalledTimes(2);
  });

  it('permite administrar acessos sem conceder conteúdo assistencial ao gestor', async () => {
    auth.refresh.mockResolvedValue({ perfis: ['gestor'] });
    api.getMe.mockReturnValue(
      of({ ...capabilities, professionalGrant: null, canAdministerAccess: true }),
    );
    expect(await enter('saude/acessos')).toBe(true);
    expect(await enter('saude')).toBe('/acesso-negado');
  });

  it('usa a capacidade própria no caminho do paciente', async () => {
    expect(await enter('minha-saude')).toBe('/acesso-negado');
    api.getMe.mockReturnValue(
      of({ ...capabilities, professionalGrant: null, canAccessOwnRecord: true }),
    );
    expect(await enter('minha-saude')).toBe(true);
    expect(await enter('saude/acessos')).toBe('/acesso-negado');
  });

  it('recusa a demonstração antes de consultar permissões locais', async () => {
    session.active.mockReturnValue(true);
    expect(await enter('saude')).toBe('/acesso-negado');
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(api.getMe).not.toHaveBeenCalled();
  });

  it('exige login quando a sessão deixa de existir', async () => {
    auth.refresh.mockResolvedValue(null);
    expect(await enter('saude')).toBe('/acesso');
    expect(api.getMe).not.toHaveBeenCalled();
  });

  it('limpa a sessão em 401 e recusa a capacidade em 403', async () => {
    api.getMe.mockReturnValue(throwError(() => ({ status: 401 })));
    expect(await enter('saude')).toBe('/acesso');
    expect(auth.clearPrincipal).toHaveBeenCalledOnce();
    api.getMe.mockReturnValue(throwError(() => ({ status: 403 })));
    expect(await enter('saude')).toBe('/acesso-negado');
  });

  it('permite mostrar o estado de falha de transporte sem inventar uma habilitação', async () => {
    api.getMe.mockReturnValue(throwError(() => ({ status: 503 })));
    expect(await enter('saude')).toBe(true);
    expect(auth.clearPrincipal).not.toHaveBeenCalled();
  });
});
