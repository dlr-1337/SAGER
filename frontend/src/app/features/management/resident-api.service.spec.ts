import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession } from '../../core/api';
import {
  ResidentApiError,
  ResidentApiService,
  ResidentPayload,
  ResidentRecord,
} from './resident-api.service';

const record: ResidentRecord = {
  id: '00000000-0000-0000-0000-000000000041',
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: null,
  course: null,
  version: 0,
};
const input: ResidentPayload = {
  name: record.name,
  enrollment: record.enrollment,
  birthDate: '2009-05-14',
  courseId: null,
  institutionalEmail: null,
  entryYear: 2026,
  extraSemesters: 1,
};

describe('ResidentApiService', () => {
  beforeEach(() => resetSession());
  afterEach(() => vi.unstubAllGlobals());

  it('consulta a coleção apenas pela API com a sessão local', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([record])));
    vi.stubGlobal('fetch', fetchMock);
    expect(await TestBed.inject(ResidentApiService).list()).toEqual([record]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/residentes',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('envia campos opcionais nulos e CSRF, adicionando versão somente na edição', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...record, version: 1 })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await TestBed.inject(ResidentApiService).save(input, record)).version).toBe(1);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`/api/v1/residentes/${record.id}`);
    expect(request.method).toBe('PUT');
    expect(request.credentials).toBe('same-origin');
    expect(request.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic' });
    expect(JSON.parse(request.body as string)).toEqual({ ...input, version: 0 });
  });

  it('propaga duplicidade sem apresentar sucesso falso', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'duplicate_enrollment' }), { status: 409 }),
        ),
    );
    await expect(TestBed.inject(ResidentApiService).save(input)).rejects.toEqual(
      new ResidentApiError(409, 'duplicate_enrollment'),
    );
  });

  it('aceita etapa, saída prevista e conclusão calculadas pelo servidor', async () => {
    const computed = {
      ...record,
      stage: 'Concluinte',
      expectedExit: '2026-06-30',
      concluded: true,
      minor: false,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([computed]))));
    expect(await TestBed.inject(ResidentApiService).list()).toEqual([computed]);
  });

  it.each([{ concluded: 'sim' }, { expectedExit: 31 }, { stage: 2 }, { minor: 'não' }])(
    'recusa campo calculado com tipo errado (%o)',
    async (wrong) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...record, ...wrong }]))),
      );
      await expect(TestBed.inject(ResidentApiService).list()).rejects.toThrow(
        'A lista de residentes recebida é inválida.',
      );
    },
  );

  it('rejeita resposta malformada para não preencher a tela com dados errados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ records: [record] }))),
    );
    await expect(TestBed.inject(ResidentApiService).list()).rejects.toThrow(
      'A lista de residentes recebida é inválida.',
    );
  });

  it('reaproveita a lista por 60 s e pede de novo depois de gravar ou de trocar a sessão', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/auth/csrf')
        return new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' }));
      return new Response(JSON.stringify(init?.method === 'GET' ? [record] : record));
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(ResidentApiService);
    const reads = () =>
      fetchMock.mock.calls.filter(
        ([url, init]) => url === '/api/v1/residentes' && init?.method === 'GET',
      ).length;
    expect(await service.list()).toEqual([record]);
    expect(await service.list()).toEqual([record]);
    expect(reads()).toBe(1);
    await service.save(input);
    await service.list();
    expect(reads()).toBe(2);
    resetSession();
    await service.list();
    expect(reads()).toBe(3);
  });
});
