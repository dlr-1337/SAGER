import { describe, expect, it } from 'vitest';
import {
  communicationStateLabels,
  notificationLabels,
} from '../features/communications/communications-local.utils';
import { messageStatusLabels, signatureStatusLabels } from '../features/operations/long-exit.utils';
import { callMarkLabels, exitStatusLabels } from '../features/operations/operations-local.utils';
import { statusTones, toneAttr } from './status-tones';

const shown = [
  ...Object.values(exitStatusLabels),
  ...Object.values(callMarkLabels),
  'Pendente',
  'Aberta',
  'Fechada',
  ...Object.values(notificationLabels),
  ...Object.values(communicationStateLabels),
  'Rascunho',
  'Publicado',
  'Retirado',
  'Valendo',
  'Anulada',
  ...Object.values(signatureStatusLabels),
  ...Object.values(messageStatusLabels),
  'Conferido',
  'Recusado',
];

describe('Tons de situação', () => {
  it('tem tom e um significado de uma frase para cada nome mostrado como situação', () => {
    const missing = shown.filter((name) => !statusTones[name]);
    expect(missing).toEqual([]);
    const long = shown.filter((name) => {
      const meaning = statusTones[name].meaning;
      return !/^[^.!?]+[.!?]$/.test(meaning);
    });
    expect(long).toEqual([]);
  });

  it('segue a tabela do design', () => {
    expect(toneAttr('Aguardando análise')).toBe('warning');
    expect(toneAttr('Aprovada')).toBe('info');
    expect(toneAttr('Retorno confirmado')).toBe('success');
    expect(toneAttr('Rejeitada')).toBe('danger');
    expect(toneAttr('Ausente')).toBe('danger');
    expect(toneAttr('Valendo')).toBe('success');
    expect(toneAttr('Expirada')).toBeNull();
    expect(toneAttr('Nome que não existe')).toBeNull();
  });
});
