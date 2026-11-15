import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService, ResidentRecord } from '../management/resident-api.service';
import { RoomApiService } from '../management/room-api.service';
import { CommunicationsLocalApiService } from './communications-local-api.service';
import { CommunicationReviewData } from './communications-local.shared';
import { NoticeFormLocalPage, audienceQuery } from './notices-local.pages';

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
        {
          provide: RoomApiService,
          useValue: {
            map: vi.fn().mockResolvedValue({
              accommodations: [{ id: 'aloj-1', code: 'A1', name: 'Alojamento Um', version: 0 }],
              units: [],
              rooms: [],
            }),
          },
        },
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

  it('desmarcar reduz a contagem e o envio, e a revisão começa pela opção e a quantidade', async () => {
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
    const recipients = data.lines.find((line) => line.label === 'Quem vai receber')!.value;
    expect(recipients.split('\n')).toEqual([
      'Todos os moradores · 1 residente',
      'Residente B · TESTE-B',
    ]);
    await fixture.whenStable();
    expect(createNotice).toHaveBeenCalledWith(
      expect.objectContaining({ residentIds: ['B'], title: 'Aviso sintético' }),
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
});
