import { describe, expect, it } from 'vitest';
import {
  DisciplineWarning,
  RecurrenceCandidate,
  WarningInput,
} from './communications-local.models';
import {
  CommunicationIntent,
  recurrenceSelectionError,
  validCivilDate,
  warningFormError,
} from './communications-local.utils';

const input: WarningInput = {
  category: 'AUSENCIA',
  severity: 'MODERADA',
  description: 'Ausência conferida na chamada',
  justification: 'A evidência foi revista pelo supervisor.',
  warningDate: '2026-09-30',
};
const warnings = [1, 2].map((index) => ({
  ...input,
  id: 'warning-' + index,
  occurrenceId: 'origin-' + index,
  version: 0,
  status: 'VIGENTE',
  requiresReview: false,
})) as DisciplineWarning[];
const candidate: RecurrenceCandidate = {
  category: 'AUSENCIA',
  minimumWarnings: 2,
  windowDays: 90,
  candidate: true,
  warnings,
};

describe('Decisões disciplinares no ambiente local', () => {
  it('valida data civil e futuro pela data do servidor em São Paulo', () => {
    expect(validCivilDate('2026-02-29')).toBe(false);
    expect(validCivilDate('2024-02-29')).toBe(true);
    expect(warningFormError(input, '2026-09-29')).toContain('futura');
    expect(warningFormError(input, '2026-09-30')).toBe('');
  });
  it('não aceita gravidade desconhecida, justificativa vazia ou descrição curta', () => {
    expect(warningFormError({ ...input, severity: 'AUTOMATICA' as any }, '2026-09-30')).toContain(
      'gravidade',
    );
    expect(warningFormError({ ...input, justification: '  ' }, '2026-09-30')).toContain('decisão');
    expect(warningFormError({ ...input, description: ' x ' }, '2026-09-30')).toContain('descrição');
  });
  it('preserva chave de idempotência na repetição manual da mesma intenção e renova após alteração', () => {
    const intent = new CommunicationIntent();
    const first = intent.for(input);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(intent.for({ ...input })).toBe(first);
    expect(intent.for({ ...input, severity: 'GRAVE' })).not.toBe(first);
    intent.reset();
    expect(intent.for(input)).not.toBe(first);
  });
  it('exige ao menos duas advertências válidas de origens distintas e da mesma categoria', () => {
    const ids = warnings.map((item) => item.id);
    expect(recurrenceSelectionError(candidate, ids)).toBe('');
    expect(recurrenceSelectionError(candidate, ids.slice(0, 1))).toContain('duas');
    expect(recurrenceSelectionError(candidate, [ids[0], ids[0]])).toContain('duas');
    expect(
      recurrenceSelectionError(
        {
          ...candidate,
          warnings: [warnings[0], { ...warnings[1], occurrenceId: warnings[0].occurrenceId }],
        },
        ids,
      ),
    ).toContain('distintas');
    expect(
      recurrenceSelectionError(
        { ...candidate, warnings: [warnings[0], { ...warnings[1], category: 'LIMPEZA' }] },
        ids,
      ),
    ).toContain('anulada');
  });
  it('exclui advertência anulada, revisão pendente, ausência de origem e categoria não homologada', () => {
    const ids = warnings.map((item) => item.id);
    for (const patch of [{ status: 'ANULADA' }, { requiresReview: true }, { occurrenceId: null }])
      expect(
        recurrenceSelectionError(
          {
            ...candidate,
            warnings: [warnings[0], { ...warnings[1], ...patch } as DisciplineWarning],
          },
          ids,
        ),
      ).not.toBe('');
    expect(recurrenceSelectionError({ ...candidate, category: 'OUTRA' }, ids)).toContain(
      'advertências suficientes',
    );
  });
});
