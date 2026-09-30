import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, HealthApiService } from './health-api.service';

const id = '00000000-0000-4000-8000-000000000041';
const requestId = '00000000-0000-4000-8000-000000000099';
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('HealthApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consulta capacidades sob demanda sem inferir habilitação do papel de gestão', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        reply({ professionalGrant: null, canAdministerAccess: true, canAccessOwnRecord: false }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const me = TestBed.inject(HealthApiService).getMe();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await firstValueFrom(me)).toEqual({
      professionalGrant: null,
      canAdministerAccess: true,
      canAccessOwnRecord: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/saude/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    );
  });

  it('rejeita capacidades malformadas sem conceder acesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          professionalGrant: null,
          canAdministerAccess: 'true',
          canAccessOwnRecord: false,
        }),
      ),
    );
    await expect(firstValueFrom(TestBed.inject(HealthApiService).getMe())).rejects.toThrow(
      'A resposta de saúde não pôde ser confirmada.',
    );
  });

  it('envia versão e destinatários explícitos com CSRF sem conteúdo clínico na partilha', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(csrf)).mockResolvedValueOnce(reply({}));
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.inject(HealthApiService).shareNote(id, 3, [requestId]);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`/api/v1/saude/notas/${id}/partilhas`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-CSRF-TOKEN': csrf.token },
    });
    expect(JSON.parse(init.body as string)).toEqual({ version: 3, recipientGrantIds: [requestId] });
  });

  it('consulta paciente próprio sem aceitar residentId e preserva cursor autorizado', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply({ items: [], nextCursor: null, totalCount: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.inject(HealthApiService).ownNotes('GENERAL', 42);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/minha-saude/notas?limit=20&category=GENERAL&beforeSequence=42');
    expect(url).not.toContain('residentId');
  });

  it('propaga revogação com referência sem substituir dados ou ecoar texto do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          reply(
            { code: 'forbidden', requestId, message: 'Texto clínico não deve entrar no erro' },
            403,
          ),
        ),
    );
    await expect(TestBed.inject(HealthApiService).notes(id)).rejects.toEqual(
      new ApiError(403, 'forbidden', requestId),
    );
  });

  it('exporta somente o caminho próprio com POST, CSRF e nome de arquivo opaco', async () => {
    const value = {
      exportId: requestId,
      generatedAt: '2026-09-30T12:00:00Z',
      requestId,
      resident: {
        id,
        name: 'Residente Sintético',
        enrollment: 'TESTE',
        birthDate: null,
        lastRecordedAt: null,
        reviewAfter: null,
      },
      notes: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(csrf))
      .mockResolvedValueOnce(reply(value));
    vi.stubGlobal('fetch', fetchMock);
    expect(await TestBed.inject(HealthApiService).export()).toEqual(value);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/minha-saude/exportacoes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({});
  });
});
