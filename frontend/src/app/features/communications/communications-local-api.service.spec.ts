import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CommunicationsApiError,
  CommunicationsLocalApiService,
  communicationsError,
} from './communications-local-api.service';
import { DisciplineTerm, OwnCommunication } from './communications-local.models';

const id = '00000000-0000-0000-0000-000000000901';
const sourceId = '00000000-0000-0000-0000-000000000902';
const item: OwnCommunication = {
  id,
  sourceId,
  kind: 'AVISO',
  contentVersion: 3,
  title: 'Reunião geral',
  body: 'Encontro no auditório.',
  publishedAt: '2026-09-30T16:00:00Z',
  status: 'PUBLICADO',
  stateReason: null,
  requiresReview: false,
  readAt: null,
  acknowledgedAt: null,
  document: null,
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
describe('Contrato privado de disciplina e comunicações', () => {
  it('aceita termo EMITIDO do contrato real e recusa alias de situação de advertência', async () => {
    const term: DisciplineTerm = {
      id,
      residentId: sourceId,
      residentName: 'Estudante Sintético',
      warningIds: [id, sourceId],
      decision: 'A base foi conferida antes da decisão.',
      status: 'EMITIDO',
      issuedAt: '2026-09-30T16:00:00Z',
      issuedBy: id,
      communicationId: sourceId,
      document: { id: sourceId, sha256: 'a'.repeat(64), size: 987, state: 'STORED' },
      version: 0,
      annulmentReason: null,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(term))
      .mockResolvedValueOnce(json({ ...term, status: 'VIGENTE' }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CommunicationsLocalApiService);
    expect(await api.term(id)).toEqual(term);
    await expect(api.term(id)).rejects.toThrow('inválidos');
  });
  afterEach(() => vi.unstubAllGlobals());
  it('consulta própria com sessão e sem criar evidência, filtros por nome ou escrita', async () => {
    const fetch = vi.fn().mockResolvedValue(json(item));
    vi.stubGlobal('fetch', fetch);
    expect(await TestBed.inject(CommunicationsLocalApiService).own(id)).toEqual(item);
    expect(fetch.mock.calls[0]).toEqual([
      '/api/v1/me/comunicacoes/' + id,
      {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    ]);
  });
  it('registra leitura e ciência separadamente com CSRF e a versão publicada exata', async () => {
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          json(
            url.endsWith('/auth/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } : item,
          ),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CommunicationsLocalApiService);
    await api.ownAction(id, 'leitura', 3);
    await api.ownAction(id, 'ciencia', 3);
    const writes = fetch.mock.calls.filter(([, options]) => options.method === 'POST');
    expect(writes.map(([url]) => url)).toEqual([
      '/api/v1/me/comunicacoes/' + id + '/leitura',
      '/api/v1/me/comunicacoes/' + id + '/ciencia',
    ]);
    expect(
      writes.every(
        ([, options]) =>
          options.body === '{"version":3}' && options.headers['X-CSRF-TOKEN'] === 'csrf-test',
      ),
    ).toBe(true);
  });
  it('recusa identificadores, versões, estados e revisão ausentes no DTO', async () => {
    const api = TestBed.inject(CommunicationsLocalApiService);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(() => api.own('resident-name')).toThrow('Identificador');
    expect(fetch).not.toHaveBeenCalled();
    for (const patch of [
      { contentVersion: -1 },
      { status: 'VISIBLE' },
      { requiresReview: undefined },
      { acknowledgedAt: 'ontem' },
    ]) {
      fetch.mockResolvedValue(json({ ...item, ...patch }));
      await expect(api.own(id)).rejects.toThrow('inválidos');
    }
  });
  it('falha fechada quando servidor não confirma o header CSRF canônico', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ headerName: 'X-Unsafe', token: 'raw-secret' }));
    vi.stubGlobal('fetch', fetch);
    await expect(
      TestBed.inject(CommunicationsLocalApiService).ownAction(id, 'ciencia', 3),
    ).rejects.toThrow('proteção');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('baixa PDF próprio pelo UUID da fonte, exige MIME privado e não usa URL pública', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('%PDF-1.7\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } }),
      )
      .mockResolvedValueOnce(new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CommunicationsLocalApiService);
    expect((await api.document(sourceId, true)).size).toBeGreaterThan(0);
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/me/termos/' + sourceId + '/documento');
    await expect(api.document(sourceId)).rejects.toThrow('PDF');
  });
  it('mantém conflito explícito sem repetir POST nem expor erro interno do servidor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ code: 'version_conflict', message: 'db-secret@private' }, 409));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CommunicationsLocalApiService);
    const error = await api.own(id).catch((error) => error);
    expect(error).toBeInstanceOf(CommunicationsApiError);
    expect(communicationsError(error)).toContain('Recarregue');
    expect(communicationsError(error)).not.toContain('db-secret');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
