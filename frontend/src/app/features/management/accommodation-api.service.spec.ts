import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccommodationApiError, AccommodationApiService } from './accommodation-api.service';

const accommodation = { id: 'a-test', code: 'TESTE-A', name: 'Alojamento Fictício', version: 0 };
const unit = {
  id: 'u-test',
  accommodationId: accommodation.id,
  code: 'CASA-01',
  name: 'Casa Fictícia',
  version: 0,
};
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' };

describe('AccommodationApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consulta o cadastro vazio sem inserir dados demonstrativos', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('[]'));
    vi.stubGlobal('fetch', mock);
    expect(await TestBed.inject(AccommodationApiService).list()).toEqual([]);
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/alojamentos',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
  });

  it('envia CSRF e a versão conhecida na edição da unidade sob seu alojamento', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...unit, version: 1 })));
    vi.stubGlobal('fetch', mock);
    await TestBed.inject(AccommodationApiService).saveUnit(
      accommodation.id,
      { code: unit.code, name: unit.name },
      unit,
    );
    const [url, request] = mock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/alojamentos/a-test/unidades/u-test');
    expect(request.method).toBe('PUT');
    expect(request.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic-csrf' });
    expect(JSON.parse(request.body as string)).toEqual({
      code: unit.code,
      name: unit.name,
      version: 0,
    });
  });

  it('envia a faixa etária ao salvar o alojamento', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...accommodation, ageGroup: 'MENORES' }), { status: 201 }),
      );
    vi.stubGlobal('fetch', mock);
    const saved = await TestBed.inject(AccommodationApiService).save({
      code: accommodation.code,
      name: accommodation.name,
      ageGroup: 'MENORES',
    });
    expect(saved.ageGroup).toBe('MENORES');
    const [url, request] = mock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/alojamentos');
    expect(JSON.parse(request.body as string)).toEqual({
      code: accommodation.code,
      name: accommodation.name,
      ageGroup: 'MENORES',
    });
  });

  it('não escreve quando o servidor recusa a obtenção de CSRF', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', mock);
    await expect(
      TestBed.inject(AccommodationApiService).save({
        code: accommodation.code,
        name: accommodation.name,
      }),
    ).rejects.toEqual(new AccommodationApiError(401));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('propaga versão obsoleta sem aceitar um cadastro salvo', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'stale_version' }), { status: 409 }),
        ),
    );
    await expect(
      TestBed.inject(AccommodationApiService).save(
        { code: accommodation.code, name: accommodation.name },
        accommodation,
      ),
    ).rejects.toEqual(new AccommodationApiError(409, 'stale_version'));
  });

  it('rejeita uma unidade que o servidor associa a outro alojamento', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([{ ...unit, accommodationId: 'other' }]))),
    );
    await expect(
      TestBed.inject(AccommodationApiService).listUnits(accommodation.id),
    ).rejects.toThrow('Lista de unidades inválida.');
  });
});
