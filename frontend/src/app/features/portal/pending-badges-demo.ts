import { type Injector, type Signal, computed } from '@angular/core';
import { DemoSessionService } from '../../core/demo-session.service';
import type { PendingCounts } from '../../core/pending-badges.service';
import { NoticesDemoService } from '../communications/notices-demo.service';
import {
  type ExitRequest,
  type ExitStatus,
  type NotificationStatus,
  OperationsDemoService,
} from '../operations/operations-demo.service';

/** Pedido que ainda espera a análise ou a conferência do supervisor. */
const WAITING_EXIT: ExitStatus[] = [
  'Aguardando análise',
  'Aguardando autorização',
  'Falha no envio',
];
// Só a notificação que ninguém viu ainda conta, como no servidor (notification-seen-evidence).
const WAITING_NOTIFICATION: NotificationStatus[] = ['Pendente'];

/**
 * Regra do servidor (design D2): no prazo, ou aprovado com a saída já chegada. A demonstração aceita
 * decidir o pedido até o retorno previsto, e esse é o prazo aqui.
 */
function waitingExit(exit: ExitRequest, now: number): boolean {
  const departure = Date.parse(exit.departure);
  const expectedReturn = Date.parse(exit.expectedReturn);
  if (WAITING_EXIT.includes(exit.status)) return expectedReturn > now;
  return exit.status === 'Aprovada' && departure <= now && expectedReturn > now;
}

/**
 * Números da demonstração (RF027) tirados dos dados fictícios em memória, sem chamar a API. Fora do
 * cenário "Padrão", as telas não mostram dados, e o menu fica sem números.
 */
export function demoPendingCounts(injector: Injector, now: Signal<number>): Signal<PendingCounts> {
  const session = injector.get(DemoSessionService);
  const operations = injector.get(OperationsDemoService);
  const notices = injector.get(NoticesDemoService);
  return computed<PendingCounts>(() => {
    if (!session.active() || session.scenario() !== 'padrao') return {};
    if (session.role() === 'supervisor') {
      const exits = operations.exits().filter((exit) => waitingExit(exit, now()));
      return {
        shortExits: exits.filter((exit) => exit.kind === 'Curta').length,
        longExits: exits.filter((exit) => exit.kind === 'Longa').length,
        notifications: operations
          .notifications()
          .filter((item) => WAITING_NOTIFICATION.includes(item.status)).length,
        nightCalls: operations.callCompleted() ? 0 : 1,
        conversations: 0,
      };
    }
    if (session.role() === 'residente') {
      const open = notices.notices().filter((item) => !item.acknowledgedAt);
      return {
        notices: open.filter((item) => item.kind === 'aviso').length,
        warnings: open.filter((item) => item.kind === 'advertencia').length,
        terms: 0,
      };
    }
    return {};
  });
}
