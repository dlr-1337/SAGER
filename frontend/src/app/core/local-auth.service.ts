import { FilterState } from './filter-state';
import { Injectable, inject, signal } from '@angular/core';
import type { Role } from './demo-session.service';
import { ACCOUNT_OPEN, SESSION_IDLE_MS, api, resetSession, touchAccount } from './api';

export interface LocalPrincipal {
  id: string;
  nome: string;
  email: string | null;
  matricula: string;
  fotoUrl: string | null;
  perfis: Role[];
  residenteId: string | null;
  supervisorId: string | null;
  /** Calculado pelo servidor; ausente vale falso (menor ou sem data). */
  maiorDeIdade?: boolean;
}

const roles: Role[] = ['gestor', 'supervisor', 'residente'];

function nullableRecordId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
  );
}

function validPrincipal(value: unknown): value is LocalPrincipal {
  if (!value || typeof value !== 'object') return false;
  const principal = value as Partial<LocalPrincipal>;
  return (
    typeof principal.id === 'string' &&
    typeof principal.nome === 'string' &&
    (principal.email === null || typeof principal.email === 'string') &&
    typeof principal.matricula === 'string' &&
    (principal.fotoUrl === null || typeof principal.fotoUrl === 'string') &&
    Array.isArray(principal.perfis) &&
    principal.perfis.length === 1 &&
    principal.perfis.every((profile) => roles.includes(profile)) &&
    nullableRecordId(principal.residenteId) &&
    nullableRecordId(principal.supervisorId) &&
    (principal.maiorDeIdade === undefined || typeof principal.maiorDeIdade === 'boolean') &&
    !(principal.residenteId && principal.supervisorId) &&
    (!principal.residenteId || principal.perfis[0] === 'residente') &&
    (!principal.supervisorId || ['gestor', 'supervisor'].includes(principal.perfis[0]))
  );
}

class InvalidLogin extends Error {}
class NoSession extends Error {}

/** Chave do localStorage que avisa as outras abas, que dividem o cookie, de uma entrada ou saída. */
export const SESSION_SIGNAL = 'sager.session';

function announce(open: boolean): void {
  try {
    localStorage.setItem(SESSION_SIGNAL, String(Date.now()));
    if (!open) localStorage.removeItem(ACCOUNT_OPEN);
  } catch {
    // Sem armazenamento, a repetição por CSRF ainda confere a conta (core/api.ts).
  }
}

/** Sessão local em memória. O cookie HttpOnly e a autorização pertencem ao servidor. */
@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  private readonly filters = inject(FilterState);
  readonly principal = signal<LocalPrincipal | null>(null);

  async refresh(): Promise<LocalPrincipal | null> {
    try {
      return await this.current();
    } catch {
      this.clearPrincipal();
      return null;
    }
  }

  /** Como refresh, mas lança quando o servidor não responde ou falha: aí a sessão pode existir. */
  async current(): Promise<LocalPrincipal | null> {
    let value: unknown = null;
    try {
      value = await (
        await api('/api/v1/auth/me', {
          error: (response) => (response.status === 401 ? new NoSession() : new Error()),
        })
      ).json();
    } catch (error) {
      if (!(error instanceof NoSession)) throw error;
      try {
        localStorage.removeItem(ACCOUNT_OPEN);
      } catch {
        // Sem armazenamento, vale só o principal desta aba.
      }
    }
    if (!validPrincipal(value)) {
      this.clearPrincipal();
      return null;
    }
    this.filters.setUser(value.id);
    this.principal.set(value);
    return value;
  }

  /** Conta conhecida nesta aba, ou que entrou neste navegador, não saiu e não expirou. */
  accountMayBeOpen(): boolean {
    if (this.principal()) return true;
    try {
      if (Date.now() - Number(localStorage.getItem(ACCOUNT_OPEN)) < SESSION_IDLE_MS) return true;
      localStorage.removeItem(ACCOUNT_OPEN);
    } catch {
      // Sem armazenamento, vale só o principal desta aba.
    }
    return false;
  }

  async login(matricula: string, password: string): Promise<'success' | 'invalid'> {
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: new URLSearchParams({ matricula, password }),
        error: (response) =>
          response.status === 401
            ? new InvalidLogin()
            : new Error(
                response.status === 429
                  ? 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'
                  : 'Não foi possível entrar. Verifique a internet e tente de novo.',
              ),
      });
    } catch (error) {
      if (!(error instanceof InvalidLogin)) throw error;
      this.clearPrincipal();
      return 'invalid';
    }
    // O cookie da conta já está aberto, mesmo que a consulta seguinte falhe.
    touchAccount(true);
    // O servidor troca a sessão e o token CSRF ao entrar.
    resetSession();
    if (!(await this.refresh()))
      throw new Error('Não foi possível entrar. Verifique a internet e tente de novo.');
    announce(true);
    return 'success';
  }

  async recover(input: Record<string, string>): Promise<void> {
    await api('/api/v1/auth/recover', {
      method: 'POST',
      body: new URLSearchParams(input),
      error: (response) =>
        new Error(
          response.status === 429
            ? 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'
            : 'Confira os dados e a senha e tente de novo.',
        ),
    });
  }

  async logout(): Promise<void> {
    await api('/api/v1/auth/logout', {
      method: 'POST',
      error: () => new Error('Não foi possível sair. Verifique a internet e tente de novo.'),
    });
    this.clearPrincipal();
    announce(false);
  }

  clearPrincipal(): void {
    this.principal.set(null);
    this.filters.setUser(null);
    this.filters.clear();
    resetSession();
  }
}
