import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { LocalAuthService } from './local-auth.service';

export type Role = 'gestor' | 'supervisor' | 'residente' | 'saude';
export type DemoScenario = 'padrao' | 'vazio' | 'erro' | 'carregando';

const roleStorageKey = 'sager.demo.role';
const activeStorageKey = 'sager.demo.active';

function storedActive(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(activeStorageKey) === 'true';
  } catch {
    return false;
  }
}

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
  private readonly auth = inject(LocalAuthService);
  readonly production =
    inject(DOCUMENT).querySelector('meta[name="sager-environment"]')?.getAttribute('content') ===
    'production';
  readonly demoAvailable = !this.production;
  readonly active = signal(this.demoAvailable && storedActive());
  private readonly demoRole = signal<Role>(storedRole());
  readonly role = computed<Role>(() =>
    this.active() ? this.demoRole() : (this.auth.principal()?.perfis[0] ?? this.demoRole()),
  );
  readonly scenario = signal<DemoScenario>('padrao');

  constructor() {
    if (!this.demoAvailable) this.deactivate();
  }

  setRole(role: Role): void {
    this.demoRole.set(role);
    try {
      globalThis.sessionStorage?.setItem(roleStorageKey, role);
    } catch {
      // O papel escolhido continua válido para a navegação atual.
    }
  }

  activate(role: Role): void {
    if (!this.demoAvailable) return;
    this.setRole(role);
    this.auth.clearPrincipal();
    this.active.set(true);
    try {
      globalThis.sessionStorage?.setItem(activeStorageKey, 'true');
    } catch {
      // A demonstração continua nesta página mesmo sem armazenamento.
    }
  }

  deactivate(): void {
    this.active.set(false);
    this.scenario.set('padrao');
    try {
      globalThis.sessionStorage?.removeItem(activeStorageKey);
    } catch {
      // A saída ainda vale para a sessão em memória.
    }
  }

  setScenario(scenario: DemoScenario): void {
    this.scenario.set(scenario);
  }

  hasRole(...roles: Role[]): boolean {
    return roles.includes(this.role());
  }
}
