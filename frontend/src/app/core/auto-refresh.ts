import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UnsavedForms } from '../shared/unsaved-forms';
import { SESSION_IDLE_MS, asAutoRefresh } from './api';
import { DemoSessionService } from './demo-session.service';

/** Intervalo padrão das telas que se atualizam sozinhas. */
export const AUTO_REFRESH_MS = 15_000;

export interface AutoRefreshOptions {
  /** Espera entre o fim de uma consulta e a próxima; função quando o ritmo muda (relatórios). */
  delayMs?: number | (() => number);
  /** Tela ocupada: gravação, conflito à vista ou texto digitado fora de formulário `sagerUnsaved`. */
  busy?: () => boolean;
  /** Continua com formulário alterado: a consulta não toca no que está sendo digitado (conversa). */
  whileEditing?: boolean;
}

export type AutoRefresh = ReturnType<typeof autoRefresh>;

/**
 * Atualização automática da tela (auto-refresh). `tick` busca os dados de novo em modo silencioso e
 * lança a falha. Reagenda só depois da resposta, não consulta com a aba oculta e consulta ao voltar,
 * pula o ciclo com formulário alterado ou gravando, diálogo aberto ou `busy()`, e pausa depois de 30
 * minutos sem clique ou tecla, para não consultar numa estação esquecida. Chame num contexto de
 * injeção (campo do componente): começa na hora, para no destroy e nunca liga na demonstração.
 */
export function autoRefresh(tick: () => Promise<unknown>, options: AutoRefreshOptions = {}) {
  const { delayMs = AUTO_REFRESH_MS, busy = () => false, whileEditing = false } = options;
  const doc = inject(DOCUMENT);
  const forms = inject(UnsavedForms);
  const dialog = inject(MatDialog);
  const state = signal<'running' | 'paused'>('running');
  const failed = signal(false);
  let stopped = inject(DemoSessionService).active();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastInteraction = Date.now();
  let inFlight = false;

  const touch = () => {
    lastInteraction = Date.now();
  };
  const visibility = () => {
    clearTimeout(timer);
    if (!doc.hidden) void run(true);
  };
  const blocked = () =>
    busy() ||
    dialog.openDialogs.length > 0 ||
    [...forms.forms].some((form) => (!whileEditing && form.dirty()) || form.saving());

  function schedule(): void {
    clearTimeout(timer);
    if (stopped || doc.hidden || state() !== 'running') return;
    timer = setTimeout(() => void run(true), typeof delayMs === 'number' ? delayMs : delayMs());
  }
  async function run(automatic: boolean): Promise<void> {
    if (inFlight || stopped || doc.hidden || state() !== 'running') return;
    if (Date.now() - lastInteraction >= SESSION_IDLE_MS) return state.set('paused');
    if (blocked()) return schedule();
    inFlight = true;
    try {
      await (automatic ? asAutoRefresh(tick) : tick());
      failed.set(false);
    } catch (error) {
      // O 401 já levou à página de acesso pelo tratamento central de api().
      if ((error as { status?: unknown } | null)?.status !== 401) failed.set(true);
    }
    inFlight = false;
    schedule();
  }

  if (!stopped) {
    doc.addEventListener('visibilitychange', visibility);
    doc.addEventListener('pointerdown', touch);
    doc.addEventListener('keydown', touch);
    schedule();
  }
  inject(DestroyRef).onDestroy(() => {
    stopped = true;
    clearTimeout(timer);
    doc.removeEventListener('visibilitychange', visibility);
    doc.removeEventListener('pointerdown', touch);
    doc.removeEventListener('keydown', touch);
  });

  return {
    state: state.asReadonly(),
    failed: failed.asReadonly(),
    /** "Retomar" é ação da pessoa: consulta na hora, sem a marca de consulta automática. */
    resume(): void {
      touch();
      state.set('running');
      void run(false);
    },
  };
}
