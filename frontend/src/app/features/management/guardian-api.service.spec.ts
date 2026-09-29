import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GuardianApiError,
  GuardianApiService,
  GuardianPayload,
  GuardianRecord,
} from './guardian-api.service';

const record: GuardianRecord = {
  id: '00000000-0000-0000-0000-000000000051',
  residentId: '00000000-0000-0000-0000-000000000041',
  name: 'Responsável Sintético',
  relationship: 'pessoa com guarda',
  phone: null,
  active: true,
  version: 0,
};
const input: GuardianPayload = {
  residentId: record.residentId,
  name: record.name,
  relationship: record.relationship,
  phone: null,
  active: true,
};

describe('GuardianApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consulta responsáveis com a sessão local sem inserir dados demonstrativos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([record])));
    vi.stubGlobal('fetch', fetchMock);
    expect(await TestBed.inject(GuardianApiService).list()).toEqual([record]);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/responsaveis', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  });

  it('envia telefone nulo, CSRF e versão apenas na edição', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...record, version: 1 })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await TestBed.inject(GuardianApiService).save(input, record)).version).toBe(1);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`/api/v1/responsaveis/${record.id}`);
    expect(request.method).toBe('PUT');
    expect(request.credentials).toBe('same-origin');
    expect(request.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic' });
    expect(JSON.parse(request.body as string)).toEqual({ ...input, version: 0 });
    expect(request.body).not.toContain('authorized');
  });

  it('propaga conflito de versão sem sinalizar sucesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'stale_version' }), { status: 409 }),
        ),
    );
    await expect(TestBed.inject(GuardianApiService).save(input, record)).rejects.toEqual(
      new GuardianApiError(409, 'stale_version'),
    );
  });

  it('rejeita resposta malformada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...record, active: 'yes' }]))),
    );
    await expect(TestBed.inject(GuardianApiService).list()).rejects.toThrow(
      'A lista de responsáveis recebida é inválida.',
    );
  });
});
