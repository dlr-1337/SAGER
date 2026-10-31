import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CleaningLocalApiService } from './cleaning-local-api.service';
import { ReportingApiError, reportingError } from './reporting-local.transport';
const id = '00000000-0000-0000-0000-000000000001';
const criteria = { PISO: 6, SUPERFICIES: 6, RESIDUOS: 6, ORGANIZACAO: 6 };
const own = {
  id,
  roomId: id,
  roomCode: 'T-01',
  evaluatedAt: '2026-09-30T16:00:00Z',
  assessmentDate: '2026-09-30',
  criteria,
  score: 6,
  observation: null,
  version: 0,
  feedback: {
    previousScore: null,
    newScore: 6,
    delta: null,
    periodMean: 6,
    position: 1,
    rankingReference: 'MONTH',
    from: '2026-09-01',
    to: '2026-09-30',
  },
};
const item = {
  ...own,
  accommodationId: id,
  timeMode: 'NOW',
  policyVersion: 1,
  recordedAt: '2026-09-30T16:00:00Z',
  recordedBy: id,
  participants: [],
  revisions: [],
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
describe('Projeções e gravação de limpeza', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('consulta própria exige projeção sem participantes, revisões ou autoria de terceiros', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(own)).mockResolvedValueOnce(json(item));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CleaningLocalApiService);
    expect(await api.own(id)).toEqual(own);
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/me/limpeza/avaliacoes/' + id);
    await expect(api.own(id)).rejects.toThrow('inválidos');
  });
  it('recusa dados de notas de outro quarto na projeção de ranking do residente', async () => {
    const row = {
      roomId: null,
      roomCode: 'T-02',
      mean: null,
      position: 1,
      assessmentCount: null,
      own: false,
    };
    const value = {
      period: 'MONTH',
      referenceDate: '2026-09-30',
      from: '2026-09-01',
      to: '2026-09-30',
      items: [row],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(value))
      .mockResolvedValueOnce(json({ ...value, items: [{ ...row, mean: 9 }] }));
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CleaningLocalApiService);
    expect((await api.ranking('MONTH', '2026-09-30', true)).items[0].mean).toBeNull();
    await expect(api.ranking('MONTH', '2026-09-30', true)).rejects.toThrow('privada');
  });
  it('envia chave de intenção no registro e versão exata na correção, com CSRF canônico', async () => {
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          json(url.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'synthetic' } : item),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const api = TestBed.inject(CleaningLocalApiService);
    await api.create({
      roomId: id,
      timeMode: 'NOW',
      criteria,
      observation: null,
      idempotencyKey: id,
    });
    await api.correct(id, {
      version: 7,
      criteria,
      observation: null,
      reason: 'Correção humana conferida.',
    });
    const writes = fetch.mock.calls.filter(([, options]) => options.method === 'POST');
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[0][1].body)).not.toHaveProperty('evaluatedAt');
    expect(JSON.parse(writes[1][1].body).version).toBe(7);
    expect(
      writes.every(
        ([, options]) =>
          options.headers['X-CSRF-TOKEN'] === 'synthetic' && options.credentials === 'same-origin',
      ),
    ).toBe(true);
  });
  it('mantém 409 e limite sem repetir ação ou mostrar mensagem interna', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ code: 'version_conflict', message: 'private secret' }, 409));
    vi.stubGlobal('fetch', fetch);
    const error = await TestBed.inject(CleaningLocalApiService)
      .get(id)
      .catch((error) => error);
    expect(error).toBeInstanceOf(ReportingApiError);
    expect(reportingError(error)).toContain('Recarregar');
    expect(reportingError(error)).not.toContain('secret');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
