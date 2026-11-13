import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterState } from '../../core/filter-state';
import { Course, CourseApiService, CourseInput } from './course-api.service';
import { CoursesPage } from './courses.page';

describe('Página válida após atualizar o catálogo de cursos', () => {
  let records: Course[];
  let fixture: ComponentFixture<CoursesPage>;
  let list: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    records = Array.from({ length: 26 }, (_, index) => ({
      id: `curso-${index + 1}`,
      name: `Curso Sintético ${String(index + 1).padStart(2, '0')}`,
      active: true,
      version: 0,
      level: 'MEDIO' as const,
      durationYears: 3,
    }));
    list = vi.fn(async () => structuredClone(records));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CourseApiService,
          useValue: {
            list,
            save: vi.fn(async ({ name }: CourseInput, current: Course, active: boolean) => {
              if (records.find((item) => item.id === current.id)?.version !== current.version)
                throw new Error('Versão desatualizada.');
              const saved = { ...current, name, active, version: current.version + 1 };
              records = records.map((item) => (item.id === current.id ? saved : item));
              return saved;
            }),
          },
        },
      ],
    });
  });

  async function create(page = 1) {
    const state = TestBed.inject(FilterState);
    state.values.set('courses-page', page);
    state.values.set('courses-query', 'Sintético');
    state.values.set('courses-status', 'active');
    fixture = TestBed.createComponent(CoursesPage);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('recusa no campo o nome só com espaços, sem chamar o servidor', async () => {
    const component = await create();
    const save = TestBed.inject(CourseApiService).save as ReturnType<typeof vi.fn>;
    component.form.controls.name.setValue('   ');
    await component.save();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.mg-field-error')?.textContent).toContain(
      'Informe um nome',
    );
  });

  it('envia nível e duração, mostra na lista e recusa duração fora de 1 a 6', async () => {
    const component = await create(0);
    const save = vi.mocked(TestBed.inject(CourseApiService).save);
    const current = component.items()[0];
    await component.edit(current);
    component.form.controls.durationYears.setValue(7);
    await component.save();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#course-duration-error')?.textContent).toContain(
      'Use um número de 1 a 6 anos.',
    );
    component.form.controls.level.setValue('SUPERIOR');
    component.form.controls.durationYears.setValue(4);
    await component.save();
    expect(save).toHaveBeenCalledWith(
      { name: current.name, level: 'SUPERIOR', durationYears: 4 },
      current,
      true,
    );
    expect(component.details({ ...current, level: 'MEDIO', durationYears: 1 })).toBe(
      'Ensino médio · 1 ano',
    );
    expect(component.details({ ...current, level: 'SUPERIOR', durationYears: 4 })).toBe(
      'Superior · 4 anos',
    );
    expect(component.details({ ...current, level: null, durationYears: null })).toBe('');
  });

  it('exige nível e duração em curso novo sem chamar o servidor', async () => {
    const component = await create(0);
    const save = vi.mocked(TestBed.inject(CourseApiService).save);
    expect(fixture.nativeElement.textContent).not.toContain('Não informado');
    component.form.controls.name.setValue('Curso Novo');
    await component.save();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#course-level-error')?.textContent).toContain(
      'Escolha o nível.',
    );
    expect(fixture.nativeElement.querySelector('#course-duration-error')?.textContent).toContain(
      'Use um número de 1 a 6 anos.',
    );
    component.form.controls.level.setValue('SUPERIOR');
    await component.save();
    expect(save).not.toHaveBeenCalled();
  });

  it('desativa curso antigo sem nível nem duração', async () => {
    records[0] = { ...records[0], level: null, durationYears: null };
    const component = await create(0);
    await component.toggle(component.items()[0]);
    expect(vi.mocked(TestBed.inject(CourseApiService).save)).toHaveBeenCalledWith(
      expect.objectContaining({ level: null, durationYears: null }),
      expect.objectContaining({ id: records[0].id }),
      false,
    );
  });

  it('desativar mantém nível e duração salvos do curso', async () => {
    records[0] = { ...records[0], level: 'MEDIO', durationYears: 3 };
    const component = await create(0);
    await component.toggle(component.items()[0]);
    expect(vi.mocked(TestBed.inject(CourseApiService).save)).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'MEDIO', durationYears: 3 }),
      expect.objectContaining({ id: records[0].id }),
      false,
    );
  });

  it('retorna à primeira página ao desativar o único curso da segunda', async () => {
    const component = await create();
    expect(component.visible()).toHaveLength(1);
    await component.toggle(component.visible()[0]);
    await fixture.whenStable();
    expect(component.filtered()).toHaveLength(25);
    expect(component.visible()).toHaveLength(25);
    expect(component.page()).toBe(0);
    expect(component.status()).toBe('active');
    expect(component.query()).toBe('Sintético');
    expect(TestBed.inject(FilterState).values.get('courses-page')).toBe(0);
  });

  it('ajusta a página quando a edição retira o último item da busca', async () => {
    const component = await create();
    await component.edit(component.visible()[0]);
    component.form.controls.name.setValue('Fora do filtro');
    await component.save();
    expect(component.filtered()).toHaveLength(25);
    expect(component.page()).toBe(0);
    expect(component.visible()).toHaveLength(25);
    expect(component.query()).toBe('Sintético');
  });

  it('normaliza a página restaurada ao carregar um catálogo menor', async () => {
    const component = await create(4);
    expect(component.page()).toBe(1);
    expect(component.visible()).toHaveLength(1);
  });

  it('usa índice zero quando o catálogo filtrado fica vazio', async () => {
    records = [{ ...records[0], name: 'Outro catálogo' }];
    const component = await create(4);
    expect(component.page()).toBe(0);
    expect(component.filtered()).toEqual([]);
    expect(component.visible()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Página 1');
  });

  it('mantém a segunda página quando ela continua válida após editar', async () => {
    const component = await create();
    await component.edit(component.visible()[0]);
    component.form.controls.name.setValue('Curso Sintético 26 revisado');
    await component.save();
    expect(component.filtered()).toHaveLength(26);
    expect(component.page()).toBe(1);
    expect(component.visible()).toHaveLength(1);
  });

  it.each([true, false])(
    'sincroniza a edição e preserva o rascunho ao alternar active=%s',
    async (active) => {
      records[0].active = active;
      const component = await create(0);
      const current = component.items()[0];
      await component.edit(current);
      component.form.controls.name.setValue('Nome em edição');
      component.form.markAsDirty();
      await component.toggle(current);
      expect(component.editing()).toEqual({ ...current, active: !active, version: 1 });
      expect(component.form.controls.name.value).toBe('Nome em edição');
      expect(component.form.dirty).toBe(true);
      await component.save();
      expect(component.error()).toBe('');
      expect(records[0]).toEqual({
        ...current,
        name: 'Nome em edição',
        active: !active,
        version: 2,
      });
      expect(component.editing()).toBeNull();
      expect(component.form.pristine).toBe(true);
    },
  );

  it('mantém a edição atual ao alternar outro curso', async () => {
    const component = await create(0);
    const [editing, other] = component.items();
    await component.edit(editing);
    component.form.controls.name.setValue('Rascunho preservado');
    component.form.markAsDirty();
    await component.toggle(other);
    expect(component.editing()).toBe(editing);
    expect(component.form.controls.name.value).toBe('Rascunho preservado');
    expect(component.form.dirty).toBe(true);
  });

  it('preserva a referência de edição e o rascunho quando o toggle falha', async () => {
    const component = await create(0);
    const current = component.items()[0];
    await component.edit(current);
    component.form.controls.name.setValue('Rascunho preservado');
    component.form.markAsDirty();
    vi.mocked(TestBed.inject(CourseApiService).save).mockRejectedValueOnce(
      new Error('Falha sintética'),
    );
    await component.toggle(current);
    expect(component.editing()).toBe(current);
    expect(component.form.controls.name.value).toBe('Rascunho preservado');
    expect(component.form.dirty).toBe(true);
    expect(component.error()).toBe('Falha sintética');
    expect(component.saving()).toBe(false);
    await component.toggle(current);
    expect(component.editing()?.version).toBe(1);
  });

  it('usa o resultado salvo mesmo se o recarregamento seguinte falhar', async () => {
    const component = await create(0);
    const current = component.items()[0];
    await component.edit(current);
    component.form.controls.name.setValue('Rascunho preservado');
    component.form.markAsDirty();
    list.mockRejectedValueOnce(new Error('Falha sintética ao recarregar'));
    await component.toggle(current);
    expect(component.editing()).toEqual({ ...current, active: false, version: 1 });
    expect(component.form.controls.name.value).toBe('Rascunho preservado');
    expect(component.form.dirty).toBe(true);
    await component.save();
    expect(records[0]).toMatchObject({ name: 'Rascunho preservado', active: false, version: 2 });
    expect(component.error()).toBe('');
  });

  it('ignora outra alteração de situação durante uma gravação pendente', async () => {
    const component = await create(0);
    const current = component.items()[0];
    const save = vi.mocked(TestBed.inject(CourseApiService).save);
    const original = save.getMockImplementation()!;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    save.mockImplementationOnce(async (...args) => {
      await pending;
      return original(...args);
    });
    const toggling = component.toggle(current);
    await component.toggle(component.items()[1]);
    expect(save).toHaveBeenCalledOnce();
    expect(component.saving()).toBe(true);
    release();
    await toggling;
    expect(component.saving()).toBe(false);
  });
});
