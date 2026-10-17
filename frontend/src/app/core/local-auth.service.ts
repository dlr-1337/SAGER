import { FilterState } from './filter-state';
import { Injectable, inject, signal } from '@angular/core';
import type { Role } from './demo-session.service';

export interface LocalPrincipal {
  id: string;
  nome: string;
  email: string | null;
  matricula: string;
  fotoUrl: string | null;
  perfis: Role[];
  residenteId: string | null;
  supervisorId: string | null;
}

interface CsrfToken {
  headerName: string;
  token: string;
}

const roles: Role[] = ['gestor', 'supervisor', 'residente', 'saude'];

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
    !(principal.residenteId && principal.supervisorId) &&
    (!principal.residenteId || principal.perfis[0] === 'residente') &&
    (!principal.supervisorId || ['gestor', 'supervisor'].includes(principal.perfis[0]))
  );
}

/** Sessão local em memória. O cookie HttpOnly e a autorização pertencem ao servidor. */
@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  private readonly filters = inject(FilterState);
  readonly principal = signal<LocalPrincipal | null>(null);

  async refresh(): Promise<LocalPrincipal | null> {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        this.clearPrincipal();
        return null;
      }
      const value: unknown = await response.json();
      if (!validPrincipal(value)) {
        this.clearPrincipal();
        return null;
      }
      this.filters.setUser(value.id);
      this.principal.set(value);
      return value;
    } catch {
      this.clearPrincipal();
      return null;
    }
  }

  async login(matricula: string, password: string): Promise<'success' | 'invalid'> {
    const csrf = await this.csrfToken();
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        [csrf.headerName]: csrf.token,
      },
      body: new URLSearchParams({ matricula, password }),
    });
    if (response.status === 401) {
      this.clearPrincipal();
      return 'invalid';
    }
    if (response.status === 429)
      throw new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.');
    if (!response.ok) throw new Error('Não foi possível iniciar a sessão local.');
    if (!(await this.refresh())) throw new Error('A sessão local não pôde ser confirmada.');
    return 'success';
  }

  async recover(input: Record<string, string>): Promise<void> {
    const csrf = await this.csrfToken();
    const response = await fetch('/api/v1/auth/recover', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        [csrf.headerName]: csrf.token,
      },
      body: new URLSearchParams(input),
    });
    if (response.status === 429)
      throw new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.');
    if (!response.ok)
      throw new Error(
        'Não foi possível redefinir. Confira os dados e a senha ou procure a equipe responsável.',
      );
  }

  async logout(): Promise<void> {
    const csrf = await this.csrfToken();
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { [csrf.headerName]: csrf.token },
    });
    if (!response.ok) throw new Error('Não foi possível encerrar a sessão local.');
    this.principal.set(null);
    this.filters.setUser(null);
    this.filters.clear();
  }

  clearPrincipal(): void {
    this.principal.set(null);
    this.filters.setUser(null);
    this.filters.clear();
  }

  private async csrfToken(): Promise<CsrfToken> {
    const response = await fetch('/api/v1/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Não foi possível obter a proteção da sessão.');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object') throw new Error('Resposta CSRF inválida.');
    const token = value as Partial<CsrfToken>;
    if (typeof token.headerName !== 'string' || typeof token.token !== 'string') {
      throw new Error('Resposta CSRF inválida.');
    }
    return { headerName: token.headerName, token: token.token };
  }
}
