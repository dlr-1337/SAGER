import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import {
  CommunicationReviewData,
  CommunicationReviewDialogComponent,
} from './communications-local.shared';
function review(data: Partial<CommunicationReviewData>) {
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
  return {
    component: TestBed.runInInjectionContext(() => new CommunicationReviewDialogComponent()),
    close,
  };
}
describe('Confirmações humanas de comunicação', () => {
  it('não confirma ciência sem marcação expressa e não marca leitura ao confirmar', () => {
    const { component, close } = review({ confirmation: 'Li esta versão.' });
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.confirmed.setValue(true);
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      reason: '',
      reasonCode: 'SEM_EVIDENCIA',
      confirmed: true,
    });
  });
  it('exige motivo válido e código para arquivar ou anular mantendo o histórico', () => {
    const { component, close } = review({ requireReason: true, archive: true });
    component.reason.setValue('curto');
    component.confirm();
    expect(close).not.toHaveBeenCalled();
    component.reason.setValue('  Evidência conferida e origem retificada.  ');
    component.code.setValue('ORIGEM_RETIFICADA');
    component.confirm();
    expect(close).toHaveBeenCalledWith({
      reason: 'Evidência conferida e origem retificada.',
      reasonCode: 'ORIGEM_RETIFICADA',
      confirmed: false,
    });
  });
});
