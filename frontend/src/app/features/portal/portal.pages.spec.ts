import { TestBed } from '@angular/core/testing';
import { DemoSessionService } from '../../core/demo-session.service';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { HomePage } from './portal.pages';

describe('HomePage', () => {
  it('mostra contagens que acompanham os registros e não antecipa a análise de saída longa', () => {
    const home = TestBed.runInInjectionContext(() => new HomePage());
    const operations = TestBed.inject(OperationsDemoService);
    const session = TestBed.inject(DemoSessionService);

    expect(home.pendingExitCount()).toBe(1);
    expect(home.shortReturnCount()).toBe(1);
    expect(home.notificationCount()).toBe(2);

    operations.exits.update((items) => items.map((item) => item.id === 'S-1045' ? { ...item, status: 'Aprovada' } : item));
    operations.exits.update((items) => items.map((item) => item.id === 'S-1048' ? { ...item, status: 'Aguardando análise' } : item));
    expect(home.pendingExitCount()).toBe(0);

    operations.exits.update((items) => items.map((item) => item.id === 'S-1048' ? { ...item, signed: true } : item));
    expect(home.pendingExitCount()).toBe(1);

    operations.notifications.update((items) => items.map((item) => ({ ...item, status: 'Arquivada' })));
    expect(home.notificationCount()).toBe(0);

    session.setScenario('erro');
    expect(home.countsAvailable()).toBe(false);
  });
});
