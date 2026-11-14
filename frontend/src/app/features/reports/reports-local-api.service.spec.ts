import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession } from '../../core/api';
import { ReportsLocalApiService } from './reports-local-api.service';
import { ReportingApiError, reportingError } from '../cleaning/reporting-local.transport';
const id = '00000000-0000-0000-0000-000000000001';
const row = {
  id,
  date: '2026-09-30',
  type: 'TERMOS',
  status: 'EMITIDO',
  residentId: null,
  residentName: null,
  roomId: null,
  roomCode: null,
  accommodationId: null,
  score: null,
  category: null,
  sourceType: 'RECURRENCE',
};
const job = {
  id,
  snapshotId: id,
  format: 'PDF',
  status: 'PENDING',
  createdAt: '2026-09-30T16:00:00Z',
  expiresAt: '2026-10-01T16:00:00Z',
  attempts: 0,
  errorCode: null,
  document: null,
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
describe('Contrato dos recortes e arquivos privados', () => {
  // O token CSRF fica em memória no módulo e passaria de outro arquivo de teste para este.
  beforeEach(() => resetSession());
  afterEach(() => vi.unstubAllGlobals());
  it('vincula paginação ao snapshot exato, limite 25 e cursor progressivo', async () => {
    const page = { snapshotId: id, offset: 0, limit: 25, nextOffset: null, total: 1, items: [row] };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(page))
      .mockResolvedValueOnce(json({ ...page, snapshotId: '00000000-0000-0000-0000-000000000002' }))
      .mockResolvedValueOnce(json({ ...page, nextOffset: 0 }))
      .mockResolvedValueOnce(json({ ...page, limit: 20 }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(ReportsLocalApiService);
    expect((await api.rows(id)).items).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toContain('offset=0&limit=25');
    await expect(api.rows(id)).rejects.toThrow('página');
    await expect(api.rows(id)).rejects.toThrow('página');
    await expect(api.rows(id)).rejects.toThrow('página');
  });
  it('falha fechada se o servidor acrescentar informação clínica ao relatório', async () => {
    const fetch = vi.fn().mockResolvedValue(
      json({
        snapshotId: id,
        offset: 0,
        limit: 25,
        nextOffset: null,
        total: 1,
        items: [{ ...row, clinicalNote: 'private' }],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(TestBed.inject(ReportsLocalApiService).rows(id)).rejects.toThrow('inválidos');
  });
  it('solicita exportação só do snapshot e formato, com CSRF, sem copiar filtros mutáveis', async () => {
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          json(url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'synthetic' } : job),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    expect((await TestBed.inject(ReportsLocalApiService).requestExport(id, 'PDF')).status).toBe(
      'PENDING',
    );
    const write = fetch.mock.calls.find(([, options]) => options.method === 'POST')!;
    expect(write[0]).toBe('/api/v1/relatorios/consultas/' + id + '/exportacoes');
    expect(write[1].body).toBe('{"format":"PDF"}');
    expect(write[1].headers['X-CSRF-TOKEN']).toBe('synthetic');
  });
  it('lista relatórios conferindo o formato, sem aceitar resposta inválida', async () => {
    const listed = {
      id,
      catalogCode: 'PRESENCA',
      filters: {
        from: '2026-09-01',
        to: '2026-09-30',
        accommodationId: null,
        roomId: null,
        residentId: null,
        status: null,
      },
      rowCount: 1,
      asOf: '2026-09-30T16:00:00Z',
      expiresAt: '2026-10-01T16:00:00Z',
      exports: [job],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json([listed]))
      .mockResolvedValueOnce(json([{ ...listed, exports: [{ ...job, status: 'READY' }] }]));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(ReportsLocalApiService);
    expect((await api.list())[0].exports[0].status).toBe('PENDING');
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/relatorios/consultas');
    await expect(api.list()).rejects.toThrow('inválidos');
  });
  it('falha de uma lista de filtros não impede usar as demais', async () => {
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/residentes')
          ? Promise.resolve(new Response('{}', { status: 503 }))
          : Promise.resolve(json({ accommodations: [], units: [], rooms: [] })),
      );
    vi.stubGlobal('fetch', fetch);
    const options = await TestBed.inject(ReportsLocalApiService).filterOptions();
    expect(options.failed).toBe(true);
    expect(options.residents).toEqual([]);
    expect(options.housing.rooms).toEqual([]);
  });
  it('exige arquivo não vazio no MIME solicitado e conserva autenticação', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('%PDF-1.7\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } }),
      )
      .mockResolvedValueOnce(new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(ReportsLocalApiService);
    expect((await api.download(id, 'PDF')).size).toBeGreaterThan(0);
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
    await expect(api.download(id, 'XLSX')).rejects.toThrow('formato');
  });
  it('preserva 410 e limite explícitos sem truncamento e sem expor detalhes internos', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ code: 'snapshot_expired', message: 'internal secret' }, 410));
    vi.stubGlobal('fetch', fetch);
    const error = await TestBed.inject(ReportsLocalApiService)
      .get(id)
      .catch((error) => error);
    expect(error).toBeInstanceOf(ReportingApiError);
    expect(reportingError(error)).toContain('expirou');
    expect(reportingError(error)).not.toContain('secret');
    expect(reportingError(new ReportingApiError(422, 'report_limit_exceeded'))).toContain(
      'Escolha um período menor',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
