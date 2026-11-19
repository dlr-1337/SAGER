import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { RoomRecord } from '../management/housing.models';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import { RoomApiService } from '../management/room-api.service';
import { CommunicationsLocalApiService } from './communications-local-api.service';
import { PublishedNotice } from './communications-local.models';
import { CommunicationReviewData } from './communications-local.shared';
import {
  NoticeDetailLocalPage,
  NoticeFormLocalPage,
  audienceInput,
  audienceQuery,
} from './notices-local.pages';

const person = (id: string, values: Partial<ResidentRecord> = {}): ResidentRecord => ({
  id,
  name: `Residente ${id}`,
  enrollment: `TESTE-${id}`,
  birthDate: '2000-01-01',
  course: null,
  version: 0,
  minor: false,
  ...values,
});
const adult = person('A');
const minor = person('B', { birthDate: '2011-03-02', minor: true });
const undated = person('C', { birthDate: null, minor: false });
const room = (id: string, code: string, unitId: string | null = null): RoomRecord => ({
  id,
  code,
  number: code,
  accommodationId: 'aloj-1',
  unitId,
  floor: null,
  capacity: null,
  situation: 'Ocupado',
  occupancy: 2,
  vacancies: null,
  version: 0,
});
const housing = {
  accommodations: [{ id: 'aloj-1', code: 'A1', name: 'Alojamento Um', version: 0 }],
  units: [{ id: 'casa-1', code: 'C1', name: 'Casa 1', accommodationId: 'aloj-1', version: 0 }],
  rooms: [room('quarto-1', 'U-101'), room('quarto-2', 'U-102', 'casa-1')],
};
const recipientsLine = (data: CommunicationReviewData) =>
  data.lines.find((line) => line.label === 'Quem vai receber')!.value;
/** O diálogo não lista ninguém: nem nome nem matrícula (notice-recipient-summary). */
function expectNoNames(data: CommunicationReviewData, people: ResidentRecord[]) {
  const text = data.lines.map((line) => line.value).join('\n');
  for (const item of people) {
    expect(text).not.toContain(item.name);
    expect(text).not.toContain(item.enrollment);
  }
}

describe('Filtros de cada opção de "Quem recebe?"', () => {
  it('pede ao servidor os moradores com quarto, do alojamento ou do quarto', () => {
    expect(audienceQuery('TODOS')?.params).toEqual({ allocated: 'true' });
    expect(audienceQuery('ALOJAMENTO', { accommodationId: 'aloj-1' })?.params).toEqual({
      accommodationId: 'aloj-1',
    });
    expect(audienceQuery('QUARTO', { roomId: 'quarto-1' })?.params).toEqual({
      roomId: 'quarto-1',
    });
    expect(audienceQuery('MAIORES')?.params).toEqual({ allocated: 'true' });
    expect(audienceQuery('MENORES')?.params).toEqual({ allocated: 'true' });
    expect(audienceQuery('ALOJAMENTO')).toBeNull();
    expect(audienceQuery('QUARTO', { accommodationId: 'aloj-1' })).toBeNull();
    expect(audienceQuery('ESCOLHER')).toBeNull();
    expect(audienceQuery('')).toBeNull();
  });

  it('envia ao servidor só a opção e o lugar, nunca o texto do grupo', () => {
    expect(audienceInput('TODOS')).toEqual({ kind: 'TODOS' });
    expect(audienceInput('ESCOLHER')).toEqual({ kind: 'ESCOLHER' });
    expect(audienceInput('ALOJAMENTO', { accommodationId: 'aloj-1', roomId: 'quarto-1' })).toEqual({
      kind: 'ALOJAMENTO',
      accommodationId: 'aloj-1',
    });
    expect(audienceInput('QUARTO', { accommodationId: 'aloj-1', roomId: 'quarto-1' })).toEqual({
      kind: 'QUARTO',
      roomId: 'quarto-1',
    });
    expect(audienceInput('QUARTO', { accommodationId: 'aloj-1' })).toBeUndefined();
    expect(audienceInput('')).toBeUndefined();
  });

  it('separa por idade só com a data de nascimento e o "minor" do servidor', () => {
    // A data de nascimento diria maior de idade; vale o cálculo do servidor, não o relógio daqui.
    const serverSaysMinor = person('D', { birthDate: '1990-01-01', minor: true });
    const people = [adult, minor, undated, serverSaysMinor];
    expect(people.filter(audienceQuery('MAIORES')!.keep)).toEqual([adult]);
    expect(people.filter(audienceQuery('MENORES')!.keep)).toEqual([minor, serverSaysMinor]);
    expect(people.filter(audienceQuery('TODOS')!.keep)).toEqual(people);
  });
});

describe('Formulário do aviso por opção', () => {
  let page: ReturnType<typeof vi.fn>;
  let createNotice: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    page = vi.fn().mockResolvedValue({ items: [adult, minor], total: 2 });
    createNotice = vi.fn().mockResolvedValue({ id: 'aviso-1' });
    open = vi.fn(() => ({ afterClosed: () => of({ reason: '', confirmed: false }) }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CommunicationsLocalApiService, useValue: { createNotice } },
        {
          provide: ResidentApiService,
          useValue: { list: vi.fn().mockResolvedValue([adult, minor, undated]), page },
        },
        { provide: RoomApiService, useValue: { map: vi.fn().mockResolvedValue(housing) } },
        { provide: MatDialog, useValue: { open, openDialogs: [] } },
        { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function create() {
    const fixture = TestBed.createComponent(NoticeFormLocalPage);
    await fixture.whenStable();
    const view = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    const choose = async (value: Parameters<typeof view.audience.setValue>[0]) => {
      view.audience.setValue(value);
      await fixture.whenStable();
    };
    return { fixture, view, element, choose };
  }

  it('começa sem opção marcada, conta quem recebe e deixa a lista recolhida', async () => {
    const { view, element, choose } = await create();
    const radios = [...element.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(radios.map((radio) => radio.parentElement!.textContent!.trim())).toEqual([
      'Todos os moradores',
      'Um alojamento',
      'Um quarto',
      'Só maiores de 18',
      'Só menores de 18',
      'Escolher pessoas',
    ]);
    expect(radios.some((radio) => radio.checked)).toBe(false);
    expect(view.form.dirty).toBe(false);
    await choose('TODOS');
    expect(page).toHaveBeenCalledWith({ allocated: 'true' }, expect.any(AbortSignal));
    expect(element.querySelector('.comm-count')!.textContent).toContain('2 residentes vão receber');
    const details = element.querySelector('details')!;
    expect(details.querySelector('summary')!.textContent).toContain('Ver quem vai receber');
    expect(details.open).toBe(false);
    expect(details.querySelectorAll('input[type=checkbox]:checked')).toHaveLength(2);
  });

  it('desmarcar reduz a contagem e o envio, e a revisão mostra só o grupo e a quantidade', async () => {
    const { fixture, view, element, choose } = await create();
    await choose('TODOS');
    const box = element.querySelector<HTMLInputElement>('details input[type=checkbox]')!;
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('.comm-count')!.textContent).toContain('1 residente vai receber');
    view.form.setValue({ title: 'Aviso sintético', body: 'Mensagem sintética.' });
    view.review();
    const data = open.mock.calls[0][1].data as CommunicationReviewData;
    expect(recipientsLine(data)).toBe('Todos os moradores · 1 residente');
    expectNoNames(data, [adult, minor]);
    await fixture.whenStable();
    expect(createNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        residentIds: ['B'],
        title: 'Aviso sintético',
        audience: { kind: 'TODOS' },
      }),
    );
  });

  it('só a última busca vale quando a opção muda antes da resposta', async () => {
    let late!: (value: unknown) => void;
    page
      .mockReturnValueOnce(new Promise((resolve) => (late = resolve)))
      .mockResolvedValueOnce({ items: [minor], total: 1 });
    const { fixture, view, element, choose } = await create();
    await choose('MAIORES');
    await choose('MENORES');
    expect(page.mock.calls[0][1].aborted).toBe(true);
    late({ items: [adult, minor], total: 2 });
    await fixture.whenStable();
    expect(view.selected()).toEqual(['B']);
    expect(element.querySelector('.comm-count')!.textContent).toContain('1 residente vai receber');
  });

  it('falha na busca mostra o erro e deixa a lista vazia', async () => {
    page.mockRejectedValueOnce(new Error('falha sintética'));
    const { view, element, choose } = await create();
    await choose('TODOS');
    expect(element.querySelector('[role=alert]')).not.toBeNull();
    expect(view.selected()).toEqual([]);
    expect(element.querySelector('details')).toBeNull();
  });

  it('opção sem ninguém avisa e não deixa salvar', async () => {
    page.mockResolvedValueOnce({ items: [], total: 0 });
    const { fixture, view, element, choose } = await create();
    await choose('MENORES');
    expect(element.querySelector('.comm-count')!.textContent).toContain(
      'Ninguém recebe com essa opção.',
    );
    view.form.setValue({ title: 'Aviso sintético', body: 'Mensagem sintética.' });
    view.review();
    await fixture.whenStable();
    expect(open).not.toHaveBeenCalled();
    expect(createNotice).not.toHaveBeenCalled();
  });

  it('um alojamento busca só depois de escolhido e mostra o seletor só nessa opção', async () => {
    const { view, element, choose } = await create();
    await choose('ALOJAMENTO');
    expect(page).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Escolha o alojamento');
    view.accommodationId.setValue('aloj-1');
    await vi.waitFor(() =>
      expect(page).toHaveBeenCalledWith({ accommodationId: 'aloj-1' }, expect.any(AbortSignal)),
    );
    await choose('TODOS');
    expect(element.textContent).not.toContain('Escolha o alojamento');
  });

  const places = [
    {
      audience: 'ALOJAMENTO',
      room: '',
      group: 'Alojamento Um',
      sent: { kind: 'ALOJAMENTO', accommodationId: 'aloj-1' },
    },
    {
      audience: 'QUARTO',
      room: 'quarto-1',
      group: 'Quarto U-101, Alojamento Um',
      sent: { kind: 'QUARTO', roomId: 'quarto-1' },
    },
    {
      audience: 'QUARTO',
      room: 'quarto-2',
      group: 'Quarto U-102, Casa 1, Alojamento Um',
      sent: { kind: 'QUARTO', roomId: 'quarto-2' },
    },
  ] as const;
  for (const place of places) {
    it(`a revisão de "${place.group}" mostra o lugar e a quantidade, sem nomes`, async () => {
      const { fixture, view, choose } = await create();
      await choose(place.audience);
      view.accommodationId.setValue('aloj-1');
      await fixture.whenStable();
      if (place.room) view.roomId.setValue(place.room);
      await vi.waitFor(() => expect(view.resolved()).toBe(true));
      view.form.setValue({ title: 'Aviso sintético', body: 'Mensagem sintética.' });
      view.review();
      const data = open.mock.calls[0][1].data as CommunicationReviewData;
      expect(recipientsLine(data)).toBe(`${place.group} · 2 residentes`);
      expectNoNames(data, [adult, minor]);
      await fixture.whenStable();
      expect(createNotice.mock.calls[0][0].audience).toEqual(place.sent);
    });
  }
});

describe('Diálogos do aviso salvo', () => {
  const draft: PublishedNotice = {
    id: 'aviso-1',
    title: 'Aviso sintético',
    body: 'Mensagem sintética.',
    residentIds: ['A', 'B'],
    status: 'RASCUNHO',
    version: 0,
    publishedAt: null,
    communicationId: null,
    withdrawalReason: null,
  };
  let notice: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notice = vi.fn().mockResolvedValue(draft);
    // Fecha sem confirmar: o teste confere só o que o diálogo mostra.
    open = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: draft.id }) } },
        },
        { provide: CommunicationsLocalApiService, useValue: { notice } },
        {
          provide: ResidentApiService,
          useValue: { list: vi.fn().mockResolvedValue([adult, minor]) },
        },
        { provide: MatDialog, useValue: { open, openDialogs: [] } },
        { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function create() {
    const fixture = TestBed.createComponent(NoticeDetailLocalPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      view: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('aviso antigo em "Revisar publicação" mostra a lista salva e a quantidade, e a página lista os nomes', async () => {
    const { view, element } = await create();
    expect(element.textContent).toContain('Residente A · TESTE-A');
    expect(element.textContent).toContain('Residente B · TESTE-B');
    await view.publish();
    const data = open.mock.calls[0][1].data as CommunicationReviewData;
    expect(data.action).toBe('Confirmar publicação');
    expect(recipientsLine(data)).toBe('Lista salva no rascunho · 2 residentes');
    expectNoNames(data, [adult, minor]);
  });

  it('o grupo gravado no rascunho aparece em "Revisar publicação", na correção e na retirada', async () => {
    notice.mockResolvedValue({ ...draft, audienceLabel: 'Todos os moradores' });
    const { view } = await create();
    await view.publish();
    notice.mockResolvedValue({
      ...draft,
      audienceLabel: 'Todos os moradores',
      status: 'PUBLICADO',
      version: 1,
    });
    await view.load();
    view.form.setValue({ title: 'Aviso sintético', body: 'Mensagem corrigida.' });
    await view.revise();
    view.withdraw();
    const dialogs = open.mock.calls.map((call) => call[1].data as CommunicationReviewData);
    expect(dialogs.map((data) => data.action)).toEqual([
      'Confirmar publicação',
      'Publicar correção',
      'Confirmar retirada',
    ]);
    for (const data of dialogs) {
      expect(recipientsLine(data)).toBe('Todos os moradores · 2 residentes');
      expectNoNames(data, [adult, minor]);
    }
  });

  it('aviso antigo, sem grupo gravado, mostra a lista salva na correção e na retirada', async () => {
    notice.mockResolvedValue({ ...draft, status: 'PUBLICADO', version: 1 });
    const { view } = await create();
    view.form.setValue({ title: 'Aviso sintético', body: 'Mensagem corrigida.' });
    await view.revise();
    view.withdraw();
    const dialogs = open.mock.calls.map((call) => call[1].data as CommunicationReviewData);
    expect(dialogs.map((data) => data.action)).toEqual(['Publicar correção', 'Confirmar retirada']);
    for (const data of dialogs) {
      expect(recipientsLine(data)).toBe('Lista salva no rascunho · 2 residentes');
      expectNoNames(data, [adult, minor]);
    }
  });
});
