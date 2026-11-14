import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, expect, it, vi } from 'vitest';
import { appConfig } from './app.config';
import { LocalAuthService, SESSION_SIGNAL } from './core/local-auth.service';

const account = (n: number) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  nome: `Conta Sintética ${n}`,
  email: null,
  matricula: `TESTE-${n}`,
  fotoUrl: null,
  perfis: ['gestor' as const],
  residenteId: null,
  supervisorId: null,
});

afterEach(() => vi.unstubAllGlobals());

it('acompanha a entrada e a saída feitas em outra aba com o mesmo cookie', async () => {
  TestBed.configureTestingModule({ providers: appConfig.providers });
  const auth = TestBed.inject(LocalAuthService);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const refresh = vi.spyOn(auth, 'refresh');
  const signal = async (me: Response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(me));
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_SIGNAL }));
    await refresh.mock.results.at(-1)?.value;
  };
  auth.principal.set(account(1));

  // A mesma conta entrou de novo: a tela continua onde está.
  await signal(new Response(JSON.stringify(account(1))));
  expect(auth.principal()?.id).toBe(account(1).id);
  expect(navigate).not.toHaveBeenCalled();

  await signal(new Response(JSON.stringify(account(2))));
  expect(auth.principal()?.id).toBe(account(2).id);
  expect(navigate).toHaveBeenLastCalledWith('/inicio');

  await signal(new Response(null, { status: 401 }));
  expect(auth.principal()).toBeNull();
  expect(navigate).toHaveBeenLastCalledWith('/acesso');

  // Sem conta na tela (acesso ou demonstração), o aviso não pede nada.
  await signal(new Response(null, { status: 401 }));
  expect(refresh).toHaveBeenCalledTimes(3);
});
