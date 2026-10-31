import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import {
  LocalOperationsReviewDialogComponent,
  LocalReviewData,
} from './review-dialog-local.component';

function create(data: Partial<LocalReviewData>) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Revisão', action: 'Confirmar', lines: [], ...data },
      },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LocalOperationsReviewDialogComponent());
  return { component, close };
}
const physical: NonNullable<LocalReviewData['physical']> = {
  action: 'retorno',
  now: '2026-09-30T20:00:00Z',
  minimum: '2026-09-30T16:00:00Z',
  expectedReturnAt: '2026-09-30T19:00:00Z',
  version: 4,
};

describe('Revisão das operações locais', () => {
  it('não confirma registro fora da janela sem ciência expressa e justificativa válida', () => {
    const { component, close } = create({ requireReason: true, requireConfirmation: true });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.reason.setValue('Registro após a ronda presencial.');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.confirmation.setValue(true);
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      reason: 'Registro após a ronda presencial.',
      confirmed: true,
    });
  });
  it('registra NOW somente com a modalidade e exige observação quando o relógio do servidor indica atraso', () => {
    const { component, close } = create({ physical });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.lateObservation.setValue('Retorno atrasado por problema no transporte.');
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      reason: '',
      confirmed: false,
      physical: {
        version: 4,
        timeMode: 'NOW',
        lateObservation: 'Retorno atrasado por problema no transporte.',
      },
    });
  });
  it('aceita retorno retroativo superior a 3 horas, preservando instante UTC e motivo', () => {
    const { component, close } = create({ physical });
    component.timeMode.setValue('RETROACTIVE');
    component.time.setValue('2026-09-30T16:30');
    component.reason.setValue('Retorno conferido no livro de portaria.');
    component.lateObservation.setValue('O transporte atrasou o retorno ao campus.');
    component.confirm();
    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        physical: {
          version: 4,
          timeMode: 'RETROACTIVE',
          occurredAt: '2026-09-30T19:30:00.000Z',
          justification: 'Retorno conferido no livro de portaria.',
          lateObservation: 'O transporte atrasou o retorno ao campus.',
        },
      }),
    );
  });
  it('rejeita retorno anterior ou igual à partida e horário futuro em relação ao servidor', () => {
    const { component, close } = create({ physical });
    component.timeMode.setValue('RETROACTIVE');
    component.reason.setValue('Registro presencial conferido.');
    component.time.setValue('2026-09-30T13:00');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    expect(component.error()).toContain('depois da saída');
    component.time.setValue('2026-09-30T17:01');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    expect(component.error()).toContain('futuro');
  });
  it('exige escolha explícita entre múltiplas saídas autorizadas', () => {
    const { component, close } = create({
      initialMark: 'AUSENCIA_JUSTIFICADA',
      authorizedExits: [
        { id: 'curta', type: 'SHORT' },
        { id: 'longa', type: 'LONG' },
      ],
    });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.authorizedExit.setValue('curta');
    component.confirm();
    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        mark: 'AUSENCIA_JUSTIFICADA',
        authorizedExit: { id: 'curta', type: 'SHORT' },
      }),
    );
  });
});
