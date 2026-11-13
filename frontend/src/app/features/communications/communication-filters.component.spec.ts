import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterState } from '../../core/filter-state';
import { ResidentApiService } from '../management/resident-api.service';
import { CommunicationFiltersComponent } from './communication-filters.component';

describe('Estados dos filtros de comunicação', () => {
  let list: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    list = vi
      .fn()
      .mockResolvedValue([{ id: 'r1', name: 'Pessoa Sintética', enrollment: 'TESTE-001' }]);
    TestBed.configureTestingModule({
      providers: [{ provide: ResidentApiService, useValue: { list } }],
    });
  });

  function create(mode: 'notices' | 'warnings' | 'notifications' | 'own') {
    const fixture = TestBed.createComponent(CommunicationFiltersComponent);
    fixture.componentRef.setInput('mode', mode);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    return { fixture, changed };
  }

  it.each([
    { mode: 'warnings', statuses: ['VIGENTE', 'ANULADA'] },
    { mode: 'notices', statuses: ['RASCUNHO', 'PUBLICADO', 'RETIRADO'] },
    { mode: 'own', statuses: ['PUBLICADO', 'RETIRADO', 'SUPERADO', 'ANULADO'] },
    {
      mode: 'notifications',
      statuses: ['PENDENTE', 'VISUALIZADA', 'EM_ANALISE', 'ARQUIVADA', 'CONVERTIDA'],
    },
  ] as const)('oferece e emite os estados da API em $mode', async ({ mode, statuses }) => {
    const { fixture, changed } = create(mode);
    await fixture.whenStable();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      'select[formControlName=status]',
    );
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', ...statuses]);
    for (const status of statuses) {
      select.value = status;
      select.dispatchEvent(new Event('change'));
      fixture.componentInstance.apply();
      expect(changed).toHaveBeenLastCalledWith({ status });
    }
  });

  it('mantém a busca à vista e os demais filtros em "Mais filtros"', async () => {
    const { fixture } = create('notifications');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const details = element.querySelector('details')!;
    expect(details.contains(element.querySelector('input[type=search]'))).toBe(false);
    for (const name of ['residentId', 'from', 'to', 'status', 'category'])
      expect(details.querySelector(`[formControlName=${name}]`)).not.toBeNull();
    expect(element.querySelectorAll('sager-filter-panel')).toHaveLength(1);
  });

  it('emite uma vez no início, vazio ou com o filtro lembrado', async () => {
    const empty = create('notices');
    await empty.fixture.whenStable();
    expect(empty.changed).toHaveBeenCalledTimes(1);
    expect(empty.changed).toHaveBeenCalledWith({});
    TestBed.inject(FilterState).values.set('communication-warnings', { category: 'LIMPEZA' });
    const remembered = create('warnings');
    await remembered.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(remembered.changed).toHaveBeenCalledTimes(1);
    expect(remembered.changed).toHaveBeenCalledWith({ category: 'LIMPEZA' });
  });

  it('mostra o residente pelo nome e busca a lista uma vez', async () => {
    const { fixture, changed } = create('warnings');
    fixture.componentRef.setInput('resident', 'r1');
    await fixture.whenStable();
    expect(changed).toHaveBeenCalledWith({ residentId: 'r1' });
    fixture.componentInstance.form.controls.category.setValue('AUSENCIA');
    fixture.componentInstance.apply();
    fixture.componentInstance.form.controls.severity.setValue('GRAVE');
    fixture.componentInstance.apply();
    fixture.detectChanges();
    expect(
      fixture.componentInstance.active().map((chip) => `${chip.label}: ${chip.value}`),
    ).toEqual([
      'Residente: Pessoa Sintética · TESTE-001',
      'Categoria: Ausência',
      'Gravidade: Grave',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('r1');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('não busca residentes nos avisos', async () => {
    const { fixture } = create('notices');
    await fixture.whenStable();
    expect(list).not.toHaveBeenCalled();
  });
});
