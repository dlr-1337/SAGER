import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Injector,
  type Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SESSION_IDLE_MS, afterWrite, api } from './api';
import { DemoSessionService, type Role } from './demo-session.service';
import { LocalAuthService } from './local-auth.service';

/** Intervalo da contagem: o dobro do das telas, por ser só um sinal de apoio (design D9). */
export const PENDING_REFRESH_MS = 30_000;
export const PENDING_URL = '/api/v1/me/pendencias';

export type PendingKey =
  | 'shortExits'
  | 'longExits'
  | 'notifications'
  | 'nightCalls'
  | 'conversations'
  | 'notices'
  | 'warnings'
  | 'terms';
export type PendingCounts = Partial<Record<PendingKey, number>>;

/** Campos que o servidor devolve para cada perfil; o gestor não tem contagem. */
export const PENDING_KEYS: Record<Role, PendingKey[]> = {
  gestor: [],
  supervisor: ['shortExits', 'longExits', 'notifications', 'nightCalls', 'conversations'],
  residente: ['notices', 'warnings', 'terms'],
};

/** Item do menu e as contagens que ele soma. */
export const PENDING_BY_PATH: Record<string, PendingKey[]> = {
  '/saidas': ['shortExits', 'longExits'],
  '/notificacoes': ['notifications'],
  '/chamada': ['nightCalls'],
  '/conversas': ['conversations'],
  '/avisos': ['notices', 'warnings', 'terms'],
};

/** Texto lido pelo leitor de tela junto do nome do item. */
export function pendingLabel(count: number): string {
  return count === 1 ? '1 pendente' : `${count} pendentes`;
}

/** Aceita só o objeto com os campos do perfil, todos inteiros de 0 em diante. */
export function parsePendingCounts(value: unknown, role: Role): PendingCounts | null {
  const keys = PENDING_KEYS[role];
  if (!keys.length || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== keys.length) return null;
  const counts: PendingCounts = {};
  for (const key of keys) {
    const count = body[key];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
    counts[key] = count;
  }
  return counts;
}

type DemoCounts = (injector: Injector, now: Signal<number>) => Signal<PendingCounts>;

/**
 * Contadores do menu e das abas (pending-badges). Na conta, consulta o servidor ao entrar, a cada
 * troca de tela, logo depois de uma gravação, a cada 30 s com a aba visível e ao voltar à aba;
 * sempre como consulta automática, que não renova a sessão. Para depois de 30 minutos sem clique ou
 * tecla, até a próxima troca de tela. Na demonstração, os números vêm dos serviços em memória.
 */
@Injectable({ providedIn: 'root' })
export class PendingBadgesService {
  private readonly doc = inject(DOCUMENT);
  private readonly session = inject(DemoSessionService);
  private readonly auth = inject(LocalAuthService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly local = signal<{ account: string; counts: PendingCounts } | null>(null);
  private readonly demo = signal<Signal<PendingCounts> | null>(null);
  /** Relógio dos números da demonstração: a saída aprovada passa a contar quando a hora chega. */
  private readonly clock = signal(Date.now());
  private demoLoading: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private paused = false;
  private inFlight = false;
  private again = false;
  private lastInteraction = Date.now();

  /** Números de quem está na tela; vazio para o gestor, sem sessão ou antes da primeira resposta. */
  readonly counts = computed<PendingCounts>(() => {
    if (this.session.active()) return this.demo()?.() ?? {};
    const principal = this.auth.principal();
    const value = this.local();
    return principal && value?.account === principal.id ? value.counts : {};
  });

  /** Soma das contagens pedidas (aba ou item do menu). */
  count(keys: readonly PendingKey[]): number {
    return sum(this.counts(), keys);
  }

  /** Contagem do item do menu com este caminho; 0 quando o item não tem contador. */
  forPath(path: string): number {
    return this.count(PENDING_BY_PATH[path] ?? []);
  }

  /** Liga a contagem uma vez por aba. O shell chama ao abrir. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const touch = () => (this.lastInteraction = Date.now());
    const visibility = () => {
      clearTimeout(this.timer);
      if (!this.doc.hidden) void this.run();
    };
    // A gravação já foi da pessoa; a contagem vem depois, quando a tela terminou de reagir.
    const stopWrites = afterWrite((url) => {
      if (!url.startsWith('/api/v1/auth/')) setTimeout(() => void this.run(), 0);
    });
    this.doc.addEventListener('visibilitychange', visibility);
    this.doc.addEventListener('pointerdown', touch);
    this.doc.addEventListener('keydown', touch);
    this.destroyRef.onDestroy(() => {
      this.started = false;
      clearTimeout(this.timer);
      stopWrites();
      this.doc.removeEventListener('visibilitychange', visibility);
      this.doc.removeEventListener('pointerdown', touch);
      this.doc.removeEventListener('keydown', touch);
    });
    void this.run();
  }

  /** Troca de tela: é ação da pessoa, então volta a contar depois da pausa. */
  refresh(): void {
    this.lastInteraction = Date.now();
    this.paused = false;
    void this.run();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (!this.started || this.paused || this.doc.hidden) return;
    this.timer = setTimeout(() => void this.run(), PENDING_REFRESH_MS);
  }

  private async run(): Promise<void> {
    if (!this.started || this.doc.hidden || this.paused) return;
    if (Date.now() - this.lastInteraction >= SESSION_IDLE_MS) {
      this.paused = true;
      clearTimeout(this.timer);
      return;
    }
    this.clock.set(Date.now());
    if (this.session.active()) await this.loadDemo();
    else await this.load();
    this.schedule();
  }

  private async load(): Promise<void> {
    if (this.inFlight) {
      this.again = true;
      return;
    }
    const principal = this.auth.principal();
    const role = principal?.perfis[0];
    if (!principal || !role || !PENDING_KEYS[role].length) return;
    this.inFlight = true;
    try {
      const response = await api(PENDING_URL, { headers: { 'X-Sager-Auto-Refresh': '1' } });
      const counts = parsePendingCounts(await response.json(), role);
      // A conta pode ter mudado durante a consulta: o número antigo não vai para a nova.
      if (counts && this.auth.principal()?.id === principal.id && !this.session.active())
        this.local.set({ account: principal.id, counts });
    } catch {
      // A falha mantém os números anteriores; o 401 já levou à página de acesso pelo api().
    } finally {
      this.inFlight = false;
    }
    if (this.again) {
      this.again = false;
      await this.load();
    }
  }

  private loadDemo(): Promise<void> {
    if (this.demo()) return Promise.resolve();
    return (this.demoLoading ??= import('../features/portal/pending-badges-demo')
      .then(({ demoPendingCounts }: { demoPendingCounts: DemoCounts }) =>
        this.demo.set(demoPendingCounts(this.injector, this.clock.asReadonly())),
      )
      .catch(() => {
        // Sem o código da demonstração (rede caiu), o menu fica sem números.
        this.demoLoading = null;
      }));
  }
}

function sum(counts: PendingCounts, keys: readonly PendingKey[]): number {
  return keys.reduce((total, key) => total + (counts[key] ?? 0), 0);
}
