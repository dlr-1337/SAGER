import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AllocationApiError,
  AllocationApiService,
  AllocationRecord,
  allocationErrorMessage,
} from './allocation-api.service';

const record: AllocationRecord = {
  id: 'a-1',
  residentId: 'r-1',
  roomId: 'q-1',
  startedAt: '2026-09-29T12:00:00Z',
  endedAt: null,
  endReason: null,
  version: 0,
};
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' };

describe('AllocationApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('filtra histórico por residente e ocupantes ativos por quarto', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify([record])));
    vi.stubGlobal('fetch', fetchMock);
    const api = TestBed.inject(AllocationApiService);
    expect(await api.byResident('r-1')).toEqual([record]);
    expect(await api.activeInRoom('q-1')).toEqual([record]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/alocacoes?residentId=r-1',
      '/api/v1/alocacoes?roomId=q-1&active=true',
    ]);
  });

  it.each([
    ['create', '/api/v1/alocacoes', { residentId: 'r-1', roomId: 'q-1' }],
    ['transfer', '/api/v1/alocacoes/a-1/transferir', { roomId: 'q-2', version: 0 }],
    ['end', '/api/v1/alocacoes/a-1/encerrar', { version: 0 }],
  ] as const)('envia %s com CSRF e versão quando exigida', async (operation, url, body) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
      .mockResolvedValueOnce(new Response(JSON.stringify(record)));
    vi.stubGlobal('fetch', fetchMock);
    const api = TestBed.inject(AllocationApiService);
    if (operation === 'create') await api.create('r-1', 'q-1');
    if (operation === 'transfer') await api.transfer('a-1', 'q-2', 0);
    if (operation === 'end') await api.end('a-1', 0);
    expect(fetchMock.mock.calls[1][0]).toBe(url);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-TOKEN': 'csrf-test', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  it('propaga conflito de lotação e não declara sucesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'room_full' }), { status: 409 }),
        ),
    );
    await expect(TestBed.inject(AllocationApiService).create('r-1', 'q-1')).rejects.toEqual(
      new AllocationApiError(409, 'room_full'),
    );
  });

  it('aceita vínculo encerrado pela conclusão do curso e explica a recusa do concluinte', async () => {
    const concluded = {
      ...record,
      endedAt: '2026-07-01T03:10:00Z',
      endReason: 'CONCLUSION' as const,
      version: 1,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([concluded]))));
    expect(await TestBed.inject(AllocationApiService).byResident('r-1')).toEqual([concluded]);
    expect(allocationErrorMessage(new AllocationApiError(409, 'resident_concluded'))).toBe(
      'Este residente concluiu o curso. Lance a prorrogação antes de colocar no quarto.',
    );
  });

  it('explica as recusas de faixa etária', () => {
    expect(allocationErrorMessage(new AllocationApiError(409, 'age_group_mismatch'))).toBe(
      'Este quarto é de outra faixa etária. Escolha um quarto da faixa do residente.',
    );
    expect(allocationErrorMessage(new AllocationApiError(409, 'birth_date_required'))).toBe(
      'Informe a data de nascimento do residente antes de colocá-lo neste quarto.',
    );
  });

  it('não envia gravação quando CSRF é recusado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Negado', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(TestBed.inject(AllocationApiService).end('a-1', 0)).rejects.toEqual(
      new AllocationApiError(403),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejeita resposta com histórico inválido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...record, version: -1 }]))),
    );
    await expect(TestBed.inject(AllocationApiService).byResident('r-1')).rejects.toThrow(
      'A lista de alocações recebida é inválida.',
    );
  });
});
