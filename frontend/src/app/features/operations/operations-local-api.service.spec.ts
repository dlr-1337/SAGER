import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationsApiError, OperationsLocalApiService } from './operations-local-api.service';
import { NightCall, ShortExit } from './operations-local.models';
import { resetSession } from '../../core/api';

const exit = {
  id: '00000000-0000-0000-0000-000000000801',
  residentId: '00000000-0000-0000-0000-000000000041',
  residentName: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  departureMode: 'NOW',
  requestedDepartureAt: '2026-09-30T16:00:00Z',
  expectedReturnAt: '2026-09-30T19:00:00Z',
  reason: 'Material escolar',
  notes: null,
  decision: null,
  decisionComment: null,
  decidedAt: null,
  actualDepartureAt: null,
  actualReturnAt: null,
  lateObservation: null,
  cancellationReason: null,
  expiryReason: null,
  createdAt: '2026-09-30T16:00:00Z',
  updatedAt: '2026-09-30T16:00:00Z',
  departureRecordedAt: null,
  returnRecordedAt: null,
  deadlineAt: '2026-09-30T19:00:00Z',
  deadlinePassed: false,
  status: 'AGUARDANDO_ANALISE',
  version: 2,
  now: '2026-09-30T16:00:00Z',
  zone: 'America/Sao_Paulo',
  capabilities: {
    canEdit: true,
    canCancel: true,
    canDecide: false,
    canDepart: false,
    canReturn: false,
  },
  history: [],
} as ShortExit;
const call = {
  id: '00000000-0000-0000-0000-000000000901',
  accommodationId: '00000000-0000-0000-0000-000000000011',
  accommodationName: 'Alojamento Teste',
  referenceDate: '2026-09-30',
  status: 'ABERTA',
  version: 7,
  openedAt: '2026-10-01T01:30:00Z',
  closedAt: null,
  outsideWindowConfirmed: false,
  justification: null,
  closeOutsideWindowConfirmed: false,
  closeJustification: null,
  summary: { total: 1, present: 0, absent: 0, justified: 0, unmarked: 1 },
  records: [
    {
      id: 'registro',
      residentId: exit.residentId,
      residentName: exit.residentName,
      enrollment: exit.enrollment,
      roomNumber: '101',
      birthDate: '2010-05-14',
      roomId: '00000000-0000-0000-0000-000000000111',
      authorizedExitId: null,
      authorizedExitType: null,
      mark: null,
      version: 0,
      history: [],
      authorizedExits: [],
    },
  ],
} as NightCall;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' };

describe('OperationsLocalApiService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSession();
  });
  it('consulta registros pela API com sessão e sem cache, respeitando busca e situação', async () => {
    const fetch = vi.fn().mockResolvedValue(json([exit]));
    vi.stubGlobal('fetch', fetch);
    expect(
      await TestBed.inject(OperationsLocalApiService).exits(
        'Nome & matrícula',
        'AGUARDANDO_ANALISE',
      ),
    ).toEqual([exit]);
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/v1/saidas-curtas?search=Nome+%26+matr%C3%ADcula&status=AGUARDANDO_ANALISE',
    );
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
  });
  it('envia NOW sem data solicitada, adiciona CSRF e envia versão somente na edição', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(csrf)).mockResolvedValueOnce(json(exit));
    vi.stubGlobal('fetch', fetch);
    await TestBed.inject(OperationsLocalApiService).saveExit(
      {
        departureMode: 'NOW',
        expectedReturnAt: exit.expectedReturnAt,
        reason: exit.reason,
        notes: null,
      },
      exit,
    );
    const [url, request] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`/api/v1/saidas-curtas/${exit.id}`);
    expect(request.method).toBe('PUT');
    expect(request.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic-token' });
    expect(JSON.parse(request.body as string)).toEqual({
      departureMode: 'NOW',
      expectedReturnAt: exit.expectedReturnAt,
      reason: exit.reason,
      notes: null,
      version: 2,
    });
  });
  it('marca presença com a versão agregada da chamada e usa justificativa na correção', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json(call))
      .mockResolvedValueOnce(json({ ...call, status: 'FECHADA' }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(OperationsLocalApiService);
    await api.mark(call, exit.residentId, 'PRESENTE');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ version: 7, mark: 'PRESENTE' });
    await api.mark(
      { ...call, status: 'FECHADA' },
      exit.residentId,
      'AUSENTE',
      'Correção conferida presencialmente.',
    );
    // O token CSRF da primeira gravação serve para a segunda.
    expect(fetch.mock.calls[2][0]).toContain('/correcoes/');
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
      version: 7,
      mark: 'AUSENTE',
      justification: 'Correção conferida presencialmente.',
    });
  });
  it('preserva instante presencial e justificativa separados do horário da gravação', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(csrf)).mockResolvedValueOnce(json(exit));
    vi.stubGlobal('fetch', fetch);
    await TestBed.inject(OperationsLocalApiService).physicalExit(exit.id, 'retorno', {
      version: 2,
      timeMode: 'RETROACTIVE',
      occurredAt: '2026-09-30T20:00:00Z',
      justification: 'Registro anterior conferido.',
      lateObservation: 'Retorno após o horário previsto.',
    });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      version: 2,
      timeMode: 'RETROACTIVE',
      occurredAt: '2026-09-30T20:00:00Z',
      justification: 'Registro anterior conferido.',
      lateObservation: 'Retorno após o horário previsto.',
    });
  });
  it('propaga conflito sem substituir os dados com demonstração ou nova versão', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json({ code: 'version_conflict' }, 409));
    vi.stubGlobal('fetch', fetch);
    await expect(
      TestBed.inject(OperationsLocalApiService).cancelExit(
        exit,
        'Solicitação cancelada pelo residente.',
      ),
    ).rejects.toEqual(new OperationsApiError(409, 'version_conflict'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('aceita a expiração do sistema, gravada sem perfil, na lista e no detalhe', async () => {
    const expired = {
      ...exit,
      status: 'EXPIRADA',
      history: [
        {
          id: 'evento',
          event: 'EXPIRE',
          actorId: null,
          actorProfile: null,
          status: 'EXPIRADA',
          version: 2,
          recordedAt: '2026-09-30T19:00:00Z',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(expired), { status: 200 })),
    );
    await expect(TestBed.inject(OperationsLocalApiService).exit(exit.id)).resolves.toMatchObject({
      history: [{ actorProfile: null }],
    });
  });

  it('rejeita respostas malformadas e preserva lista vazia', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ content: [exit] }))
      .mockResolvedValueOnce(json([{ ...exit, capabilities: { canEdit: 'true' } }]))
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(OperationsLocalApiService);
    await expect(api.exits()).rejects.toThrow('Não deu certo');
    await expect(api.exits()).rejects.toThrow('Não deu certo');
    expect(await api.exits()).toEqual([]);
  });
});
