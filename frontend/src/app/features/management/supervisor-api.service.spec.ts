import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession } from '../../core/api';
import { SupervisorApiError, SupervisorApiService } from './supervisor-api.service';

const item = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Supervisora Exemplo',
  institutionalId: 'TESTE-001',
  email: 'supervisora@example.invalid',
  version: 2,
};

describe('SupervisorApiService', () => {
  beforeEach(() => resetSession());
  afterEach(() => vi.unstubAllGlobals());

  it('consulta somente a API com cookie da sessão local', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([item]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await TestBed.inject(SupervisorApiService).list();

    expect(results).toEqual([item]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/supervisores',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('envia CSRF e versão apenas ao atualizar, e aceita o cadastro persistido', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...item, version: 3 }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const saved = await TestBed.inject(SupervisorApiService).save(
      { name: item.name, institutionalId: item.institutionalId, email: item.email },
      { id: item.id, version: item.version },
    );

    expect(saved.version).toBe(3);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`/api/v1/supervisores/${item.id}`);
    expect(request.method).toBe('PUT');
    expect(request.credentials).toBe('same-origin');
    expect(request.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': 'csrf-test',
    });
    expect(JSON.parse(request.body as string)).toEqual({
      name: item.name,
      institutionalId: item.institutionalId,
      email: item.email,
      version: 2,
    });
  });

  it('envia a senha ao criar, em POST', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(item), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      name: item.name,
      institutionalId: item.institutionalId,
      email: item.email,
      password: 'Senha teste 123!',
      passwordConfirmation: 'Senha teste 123!',
    };

    await TestBed.inject(SupervisorApiService).save(input);

    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/supervisores');
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body as string)).toEqual(input);
  });

  it('propaga conflito sem confundi-lo com um cadastro salvo', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' })),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'duplicate_institutional_id' }), { status: 409 }),
        ),
    );

    await expect(
      TestBed.inject(SupervisorApiService).save({
        name: item.name,
        institutionalId: item.institutionalId,
        email: item.email,
      }),
    ).rejects.toEqual(new SupervisorApiError(409, 'duplicate_institutional_id'));
  });

  it('rejeita resposta malformada para não mostrar sucesso falso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [item] }))),
    );
    await expect(TestBed.inject(SupervisorApiService).list()).rejects.toThrow(
      'A lista de supervisores recebida é inválida.',
    );
  });
});
