import { describe, expect, it } from 'vitest';
import { LongExitInput } from './long-exit.models';
import { longExitFormError, longPeriodError, sendFailureText } from './long-exit.utils';

const now = '2026-09-30T15:59:00Z';
const departure = '2026-09-30T16:00:00Z';
const input: LongExitInput = {
  guardianId: 'responsavel-elegivel',
  departureMode: 'SCHEDULED',
  requestedDepartureAt: departure,
  expectedReturnAt: '2026-09-30T20:00:00Z',
  reason: 'Visita à família',
  notes: null,
};
describe('Plano de saída longa', () => {
  it('aceita mais de três horas e rejeita o limite da saída curta', () => {
    expect(longExitFormError(input, now)).toBe('');
    expect(
      longExitFormError({ ...input, expectedReturnAt: '2026-09-30T19:00:00Z' }, now),
    ).toContain('mais de 3 horas');
    expect(longExitFormError({ ...input, expectedReturnAt: '2026-09-30T19:00:00.001Z' }, now)).toBe(
      '',
    );
  });
  it('limita a duração: 3 h recusada; 3 h 01 e 30 dias aceitos', () => {
    expect(longPeriodError(departure, '2026-09-30T19:00:00Z')).toContain('mais de 3 horas');
    expect(longPeriodError(departure, '2026-09-30T19:01:00Z')).toBe('');
    expect(longPeriodError(departure, '2026-10-30T16:00:00Z')).toBe('');
    expect(longPeriodError(departure, departure)).toContain('depois da saída');
  });
  it('NOW parado perde o limite quando o horário do servidor avança', () => {
    const idle = { ...input, departureMode: 'NOW' as const, requestedDepartureAt: undefined };
    expect(longExitFormError(idle, '2026-09-30T16:00:00Z')).toBe('');
    expect(longExitFormError(idle, '2026-09-30T17:00:00Z')).toContain('mais de 3 horas');
  });
  it('usa o instante do servidor para NOW e não aceita agendamento passado', () => {
    expect(
      longExitFormError({ ...input, departureMode: 'NOW', requestedDepartureAt: undefined }, now),
    ).toBe('');
    expect(longExitFormError(input, '2026-09-30T16:00:01Z')).toContain('depois de agora');
  });
  it('recusa partida agendada igual ao horário do servidor, como o backend', () => {
    expect(longExitFormError(input, departure)).toContain('depois de agora');
  });
  it('exige responsável escolhido e retorno posterior', () => {
    expect(longExitFormError({ ...input, guardianId: '' }, now)).toContain('quem vai autorizar');
    expect(longExitFormError({ ...input, expectedReturnAt: departure }, now)).toContain(
      'depois da saída',
    );
    expect(longExitFormError({ ...input, reason: '  ' }, now)).toContain('motivo');
  });
});
describe('Motivo da falha no envio', () => {
  it('explica a sessão desconectada e o número sem WhatsApp', () => {
    expect(sendFailureText('session_not_ready', 'QUEUED')).toContain('não está conectado');
    expect(sendFailureText('provider_not_found', 'QUEUED')).toContain('não está conectado');
    expect(sendFailureText('recipient_not_found', 'FAILED')).toContain('não tem WhatsApp');
  });
  it('só promete nova tentativa enquanto ela existe', () => {
    expect(sendFailureText('provider_read_timeout', 'QUEUED')).toContain('tenta de novo');
    expect(sendFailureText('session_not_ready', 'FAILED')).toContain(
      'tentativas automáticas acabaram',
    );
    const uncertain = sendFailureText('provider_read_timeout', 'UNCERTAIN');
    expect(uncertain).toContain('Confira no celular');
    expect(uncertain).not.toContain('tenta de novo');
  });
  it('mostra o código, sem culpar o telefone, quando a falha não é conhecida', () => {
    const text = sendFailureText('retry_exhausted', 'FAILED');
    expect(text).toContain('retry_exhausted');
    expect(text).not.toContain('telefone');
  });
});
