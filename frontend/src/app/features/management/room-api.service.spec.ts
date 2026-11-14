import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession } from '../../core/api';
import { HousingMap, RoomRecord, RoomRecordInput } from './housing.models';
import { RoomApiError, RoomApiService } from './room-api.service';

const room: RoomRecord = {
  id: 'quarto-01',
  code: 'TESTE-Q01',
  number: '01',
  accommodationId: 'alojamento-1',
  unitId: null,
  floor: null,
  capacity: null,
  situation: 'Disponível',
  occupancy: 0,
  vacancies: null,
  version: 0,
};
const input: RoomRecordInput = {
  code: room.code,
  number: room.number,
  accommodationId: room.accommodationId,
  unitId: null,
  floor: null,
  capacity: null,
  situation: room.situation,
};
const map: HousingMap = {
  accommodations: [
    { id: 'alojamento-1', code: 'TESTE-A01', name: 'Alojamento Fictício', version: 0 },
  ],
  units: [
    {
      id: 'unidade-1',
      accommodationId: 'alojamento-1',
      code: 'TESTE-U01',
      name: 'Casa Fictícia',
      version: 0,
    },
  ],
  rooms: [room],
};
const csrf = { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' };

describe('RoomApiService', () => {
  beforeEach(() => resetSession());
  afterEach(() => vi.unstubAllGlobals());

  it('aceita mapa inicial com versão zero de alojamento, unidade e quarto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(map)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await TestBed.inject(RoomApiService).map()).toEqual(map);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/quartos/mapa',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it.each([['MENORES'], ['MAIORES'], [null], [undefined]])(
    'aceita alojamento do mapa com faixa %s',
    async (ageGroup) => {
      const withGroup = { ...map, accommodations: [{ ...map.accommodations[0], ageGroup }] };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(withGroup))));
      expect((await TestBed.inject(RoomApiService).map()).accommodations[0].ageGroup ?? null).toBe(
        ageGroup ?? null,
      );
    },
  );

  it('rejeita mapa com faixa etária desconhecida', async () => {
    const invalid = { ...map, accommodations: [{ ...map.accommodations[0], ageGroup: 'ADULTOS' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid))));
    await expect(TestBed.inject(RoomApiService).map()).rejects.toThrow(
      'O mapa recebido é inválido.',
    );
  });

  it('aceita criação na versão zero, preservando número textual e nulos com CSRF', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
      .mockResolvedValueOnce(new Response(JSON.stringify(room), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const saved = await TestBed.inject(RoomApiService).save(input);
    expect(saved.number).toBe('01');
    expect(saved.version).toBe(0);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/quartos');
    expect(request.method).toBe('POST');
    expect(request.credentials).toBe('same-origin');
    expect(request.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': 'csrf-test',
    });
    expect(JSON.parse(request.body as string)).toEqual(input);
  });

  it('envia versão zero na primeira edição e recebe versão incrementada', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...room, version: 1 })));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (await TestBed.inject(RoomApiService).save(input, { id: room.id, version: 0 })).version,
    ).toBe(1);
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/quartos/quarto-01');
    expect(request.method).toBe('PUT');
    expect(JSON.parse(request.body as string)).toEqual({ ...input, version: 0 });
  });

  it.each(['duplicate_code', 'duplicate_location', 'invalid_location', 'stale_version'])(
    'propaga %s sem anunciar salvamento',
    async (code) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify(csrf)))
          .mockResolvedValueOnce(new Response(JSON.stringify({ code }), { status: 409 })),
      );
      await expect(TestBed.inject(RoomApiService).save(input)).rejects.toEqual(
        new RoomApiError(409, code),
      );
    },
  );

  it('não envia mutação quando CSRF é recusado e preserva o status mesmo sem JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Acesso negado', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(TestBed.inject(RoomApiService).save(input)).rejects.toEqual(new RoomApiError(403));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...room, capacity: 1.5 },
    { ...room, occupancy: -1 },
    { ...room, vacancies: 3 },
    { ...room, capacity: 2, occupancy: 1, vacancies: 2 },
    { ...room, number: 1 },
    { ...room, version: -1 },
  ])('rejeita contrato inválido sem sucesso falso: %j', async (record) => {
    const invalid = { ...map, rooms: [record] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid))));
    await expect(TestBed.inject(RoomApiService).map()).rejects.toThrow(
      'O mapa recebido é inválido.',
    );
  });

  it.each([[{}], [{ cleaningScore: null }]])(
    'aceita quarto com e sem cleaningScore: %j',
    async (extra) => {
      const withExtra = { ...map, rooms: [{ ...room, ...extra }] };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(withExtra))));
      expect((await TestBed.inject(RoomApiService).map()).rooms[0].id).toBe(room.id);
    },
  );

  it('devolve alojamentos, casas, pisos e quartos em ordem natural', async () => {
    const place = (id: string, name: string, accommodationId?: string) => ({
      id,
      code: id,
      name,
      version: 0,
      ...(accommodationId ? { accommodationId } : {}),
    });
    const at = (
      id: string,
      accommodationId: string,
      unitId: string | null,
      floor: string | null,
    ) => ({
      ...room,
      id,
      code: id,
      number: id.split('-').at(-1)!,
      accommodationId,
      unitId,
      floor,
    });
    const unsorted = {
      accommodations: [place('a10', 'Residência 10'), place('a2', 'Residência 2')],
      units: [place('u10', 'Casa 10', 'a2'), place('u2', 'Casa 2', 'a2')],
      rooms: [
        at('r10-10', 'a10', null, null),
        at('r10-1', 'a10', null, null),
        at('r10-2', 'a10', null, null),
        at('c10-1', 'a2', 'u10', null),
        at('c2-piso1-1', 'a2', 'u2', '1'),
        at('c2-terreo-1', 'a2', 'u2', 'Térreo'),
        at('c2-sem-1', 'a2', 'u2', null),
        at('fora-9', 'a2', null, null),
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(unsorted))));
    const sorted = await TestBed.inject(RoomApiService).map();
    expect(sorted.accommodations.map((item) => item.name)).toEqual([
      'Residência 2',
      'Residência 10',
    ]);
    expect(sorted.units.map((item) => item.name)).toEqual(['Casa 2', 'Casa 10']);
    expect(sorted.rooms.map((item) => item.id)).toEqual([
      'fora-9',
      'c2-sem-1',
      'c2-terreo-1',
      'c2-piso1-1',
      'c10-1',
      'r10-1',
      'r10-2',
      'r10-10',
    ]);
  });

  it('rejeita mapa com unidade pertencente a outro alojamento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accommodations: [
              ...map.accommodations,
              { id: 'alojamento-2', code: 'A2', name: 'Outro Alojamento Fictício', version: 1 },
            ],
            units: [
              {
                id: 'unidade-2',
                accommodationId: 'alojamento-2',
                code: 'U2',
                name: 'Casa Fictícia',
                version: 1,
              },
            ],
            rooms: [{ ...room, unitId: 'unidade-2' }],
          }),
        ),
      ),
    );
    await expect(TestBed.inject(RoomApiService).map()).rejects.toThrow(
      'Os vínculos do mapa recebido são inválidos.',
    );
  });

  it('rejeita mapa sem os três arrays exigidos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ rooms: [room] }))),
    );
    await expect(TestBed.inject(RoomApiService).map()).rejects.toThrow(
      'O mapa recebido é inválido.',
    );
  });

  it('reaproveita o mapa por 60 s e pede de novo depois de gravar ou de trocar a sessão', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/auth/csrf') return new Response(JSON.stringify(csrf));
      return new Response(JSON.stringify(url === '/api/v1/quartos/mapa' ? map : room));
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = TestBed.inject(RoomApiService);
    const reads = () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/v1/quartos/mapa').length;
    expect(await service.map()).toEqual(map);
    expect(await service.map()).toEqual(map);
    expect(reads()).toBe(1);
    await service.save(input);
    await service.map();
    expect(reads()).toBe(2);
    resetSession();
    await service.map();
    expect(reads()).toBe(3);
  });
});
