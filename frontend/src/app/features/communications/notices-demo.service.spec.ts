import { TestBed } from '@angular/core/testing';
import { NoticesDemoService } from './notices-demo.service';
import { OperationsDemoService } from '../operations/operations-demo.service';

describe('NoticesDemoService', () => {
  it('mantém leitura separada da ciência e evita duplicidade', () => {
    const service = TestBed.inject(NoticesDemoService);
    const id = 'av-1';
    expect(service.notices().find(item => item.id === id)?.acknowledgedAt).toBeUndefined();

    service.open(id);
    const read = service.notices().find(item => item.id === id);
    expect(read?.readAt).toBeTruthy();
    expect(read?.acknowledgedAt).toBeUndefined();

    service.acknowledge(id);
    const firstAcknowledgement = service.notices().find(item => item.id === id)?.acknowledgedAt;
    expect(firstAcknowledgement).toBeTruthy();
    service.acknowledge(id);
    expect(service.notices().find(item => item.id === id)?.acknowledgedAt).toBe(firstAcknowledgement);
  });

  it('mostra ao residente sua advertência criada manualmente após análise', () => {
    const operations = TestBed.inject(OperationsDemoService);
    const service = TestBed.inject(NoticesDemoService);
    operations.warnings.set([{id:'W-1',notificationId:'N-1',resident:'Ana Luísa Ribeiro',description:'Descrição demonstrativa',date:'2026-09-25',severity:'Leve',justification:'Análise humana registrada'}]);
    const notice = service.notices().find(item => item.id === 'warning-W-1');
    expect(notice?.kind).toBe('advertencia');
    expect(notice?.acknowledgedAt).toBeUndefined();
    service.open('warning-W-1');
    expect(service.notices().find(item => item.id === 'warning-W-1')?.acknowledgedAt).toBeUndefined();
    service.acknowledge('warning-W-1');
    expect(service.notices().find(item => item.id === 'warning-W-1')?.acknowledgedAt).toBeTruthy();
  });
});
