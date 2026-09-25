import { Injectable, signal } from '@angular/core';

export type Role = 'gestor' | 'supervisor' | 'residente';
export type DemoScenario = 'padrao' | 'vazio' | 'erro' | 'carregando';

const roleStorageKey = 'sager.demo.role';

function storedRole(): Role {
  try {
    const value = globalThis.sessionStorage?.getItem(roleStorageKey);
    if (value === 'gestor' || value === 'supervisor' || value === 'residente') return value;
  } catch {
    // A navegação continua possível quando o navegador bloqueia sessionStorage.
  }
  return 'supervisor';
}

/** Sessão exclusivamente local e temporária para navegar pelo protótipo. */
@Injectable({ providedIn: 'root' })
export class DemoSessionService {
  readonly role = signal<Role>(storedRole());
  readonly scenario = signal<DemoScenario>('padrao');

  setRole(role: Role): void {
    this.role.set(role);
    try {
      globalThis.sessionStorage?.setItem(roleStorageKey, role);
    } catch {
      // O papel escolhido continua válido para a navegação atual.
    }
  }

  setScenario(scenario: DemoScenario): void {
    this.scenario.set(scenario);
  }

  hasRole(...roles: Role[]): boolean {
    return roles.includes(this.role());
  }
}
