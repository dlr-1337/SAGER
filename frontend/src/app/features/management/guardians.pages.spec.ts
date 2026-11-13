import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi, MockInstance } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ReviewDialogService } from '../../shared/review-dialog.component';
import { UnsavedForms } from '../../shared/unsaved-form';
import { GuardianApiService, GuardianRecord } from './guardian-api.service';
import { GuardianFormPage, GuardiansPage } from './guardians.pages';
import { ManagementDemoService } from './management-demo.service';
import { ResidentApiService } from './resident-api.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe.each([false, true])('Envio de responsável (demo=%s)', (demo) => {
  const resident = { id: 'residente-teste', name: 'Estudante Sintético' };
  const saved = {
    id: 'responsavel-teste',
    residentId: resident.id,
    name: 'Responsável Sintético',
    relationship: 'Mãe',
    phone: '62999990000',
    active: true,
    authorized: false,
    version: 1,
  };
  let fixture: ComponentFixture<GuardianFormPage>;
  let save: ReturnType<typeof vi.fn>;
  let navigate: MockInstance<Router['navigate']>;
  let confirmation: Subject<boolean>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    save = demo ? vi.fn().mockReturnValue(saved) : vi.fn().mockResolvedValue(saved);
    confirmation = new Subject<boolean>();
    open = vi.fn(() => confirmation);
    TestBed.configureTestingModule({
      imports: [GuardianFormPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: DemoSessionService,
          useValue: { active: signal(demo), hasRole: () => true },
        },
        {
          provide: ManagementDemoService,
          useValue: { residents: signal([resident]), resident: () => resident, saveGuardian: save },
        },
        { provide: GuardianApiService, useValue: { save } },
        { provide: ResidentApiService, useValue: { list: vi.fn().mockResolvedValue([resident]) } },
        { provide: ReviewDialogService, useValue: { open } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(GuardianFormPage);
    await fixture.whenStable();
    const { id, version, ...fields } = saved;
    fixture.componentInstance.form.setValue(fields);
    fixture.componentInstance.form.markAsDirty();
  });

  it('mantém botão e handler bloqueados até a navegação terminar, liberando o guard após gravar', async () => {
    const navigation = deferred<boolean>();
    navigate.mockReturnValueOnce(navigation.promise);
    const component = fixture.componentInstance;
    const pending = component.save();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(component.saving()).toBe(false);
    expect(component.form.pristine).toBe(true);
    expect(TestBed.inject(UnsavedForms).canLeave()).toBe(true);
    expect(open).not.toHaveBeenCalled();
    const blocked = button.disabled;
    button.click();
    await component.save();
    const writes = save.mock.calls.length;
    navigation.resolve(true);
    await pending;
    expect(blocked).toBe(true);
    expect(writes).toBe(1);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it.each(['cancelada', 'rejeitada'])(
    'conserva ID e versão quando a navegação é %s e permite atualizar sem criar outro cadastro',
    async (outcome) => {
      if (outcome === 'cancelada') navigate.mockResolvedValueOnce(false);
      else navigate.mockRejectedValueOnce(new Error('Falha de rota sintética'));
      const component = fixture.componentInstance;
      await component.save();
      expect(component.error()).toContain('salvo');
      expect(component.form.pristine).toBe(true);
      expect(component.saving()).toBe(false);
      component.form.controls.name.setValue('Responsável atualizado');
      component.form.markAsDirty();
      const updated = { ...saved, name: 'Responsável atualizado', version: 2 };
      if (demo) save.mockReturnValueOnce(updated);
      else save.mockResolvedValueOnce(updated);
      await component.save();
      expect(save).toHaveBeenCalledTimes(2);
      if (demo) expect(save.mock.calls[1][2]).toBe(saved.id);
      else expect(save.mock.calls[1][1]).toMatchObject({ id: saved.id, version: 1 });
      expect(component.localGuardian()).toEqual(updated);
      expect(component.error()).toBe('');
    },
  );

  it('mostra as regras no campo e o telefone com máscara ao sair dele', async () => {
    const form = fixture.componentInstance.form;
    const native = fixture.nativeElement as HTMLElement;
    form.controls.name.setValue('Maria');
    form.controls.relationship.setValue('12');
    form.controls.phone.setValue('91234-5678');
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(native.querySelector('#guardian-name-error')!.textContent).toBe(
      'Digite o nome completo, como no documento.',
    );
    expect(native.querySelector('#guardian-relationship-error')!.textContent).toBe(
      'Escreva o vínculo, como mãe ou pai.',
    );
    expect(native.querySelector('#guardian-phone-error')!.textContent).toBe(
      'Digite o telefone com DDD.',
    );
    const phone = native.querySelector<HTMLInputElement>('input[formControlName="phone"]')!;
    expect(phone.getAttribute('autocomplete')).toBe('off');
    phone.value = '62912345678';
    phone.dispatchEvent(new Event('input'));
    phone.dispatchEvent(new Event('blur'));
    expect(phone.value).toBe('(62) 91234-5678');
    expect(form.controls.phone.valid).toBe(true);
  });

  it('libera nova tentativa após falhar a gravação, preservando os dados pendentes', async () => {
    if (demo)
      save.mockImplementationOnce(() => {
        throw new Error('Falha sintética');
      });
    else save.mockRejectedValueOnce(new Error('Falha sintética'));
    const component = fixture.componentInstance;
    await component.save();
    expect(component.form.dirty).toBe(true);
    expect(component.form.controls.name.value).toBe(saved.name);
    expect(component.saving()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    await component.save();
    expect(save).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledOnce();
  });

  if (!demo) {
    it('bloqueia saída e reenvio durante uma gravação mesmo com o formulário pristine', async () => {
      const response = deferred<GuardianRecord>();
      save.mockReturnValueOnce(response.promise);
      const component = fixture.componentInstance;
      component.form.markAsPristine();
      const pending = component.save();
      const leaving = TestBed.inject(UnsavedForms).canLeave();
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Salvamento em andamento' }),
      );
      confirmation.next(true);
      expect(await leaving).toBe(false);
      await component.save();
      expect(save).toHaveBeenCalledOnce();
      response.resolve(saved);
      await pending;
      expect(TestBed.inject(UnsavedForms).canLeave()).toBe(true);
    });
  }
});

describe('Responsável antigo em sessão local', () => {
  it('edita outro campo sem reescrever nome ou telefone salvos', async () => {
    const old: GuardianRecord = {
      id: 'responsavel-antigo',
      residentId: 'residente-teste',
      name: 'maria  RITA',
      relationship: '12',
      phone: null,
      active: true,
      version: 3,
    };
    const save = vi.fn().mockResolvedValue(old);
    TestBed.configureTestingModule({
      imports: [GuardianFormPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: old.id }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
        { provide: ManagementDemoService, useValue: {} },
        { provide: GuardianApiService, useValue: { save, get: async () => old } },
        { provide: ResidentApiService, useValue: { list: async () => [] } },
        { provide: ReviewDialogService, useValue: {} },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(GuardianFormPage);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    form.controls.active.setValue(false);
    await fixture.componentInstance.save();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'maria  RITA',
        relationship: '12',
        phone: null,
        active: false,
      }),
      old,
    );
    form.controls.name.setValue('Maria');
    expect(form.controls.name.invalid).toBe(true);
    form.controls.phone.setValue('6');
    expect(form.controls.phone.invalid).toBe(true);
  });
});

describe('Paginação de responsáveis na demonstração', () => {
  it('renderiza 25 registros e depois somente os três restantes, mantendo o total', async () => {
    const guardians = Array.from({ length: 28 }, (_, index) => ({
      id: `responsavel-${index + 1}`,
      residentId: 'residente-teste',
      name: `Responsável ${index + 1}`,
      relationship: 'Mãe',
      phone: '',
      active: true,
      authorized: false,
      version: 0,
    }));
    const resident = {
      id: 'residente-teste',
      name: 'Estudante Sintético',
      enrollment: 'TESTE-001',
    };
    const remotePage = vi.fn();
    const residentList = vi.fn();
    TestBed.configureTestingModule({
      imports: [GuardiansPage],
      providers: [
        provideRouter([]),
        {
          provide: DemoSessionService,
          useValue: { active: signal(true), scenario: signal('padrao'), hasRole: () => true },
        },
        {
          provide: ManagementDemoService,
          useValue: {
            guardians: signal(guardians),
            residents: signal([resident]),
            resident: () => resident,
            guardian: (id: string) => guardians.find((item) => item.id === id),
          },
        },
        { provide: GuardianApiService, useValue: { page: remotePage } },
        { provide: ResidentApiService, useValue: { list: residentList } },
      ],
    });
    const fixture = TestBed.createComponent(GuardiansPage);
    await fixture.whenStable();
    const names = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('article.mg-row h3') as NodeListOf<HTMLElement>,
      ).map((heading) => heading.textContent?.trim());
    const next: HTMLButtonElement = fixture.nativeElement.querySelector(
      'sager-pagination button:last-of-type',
    );
    expect(names()).toEqual(guardians.slice(0, 25).map((item) => item.name));
    expect(fixture.nativeElement.textContent).toContain('1–25 de 28');
    next.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Responsável 26', 'Responsável 27', 'Responsável 28']);
    expect(fixture.nativeElement.textContent).toContain('26–28 de 28');
    expect(next.disabled).toBe(true);
    fixture.componentInstance.activeFilter.setValue('true');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(remotePage).not.toHaveBeenCalled();
    expect(residentList).not.toHaveBeenCalled();
  });
});

describe('Opções de residente dos responsáveis', () => {
  it('pede os residentes uma vez, mesmo depois de trocar de página e de filtro', async () => {
    const resident = {
      id: 'residente-teste',
      name: 'Estudante Sintético',
      enrollment: 'TESTE-001',
    };
    const list = vi.fn().mockResolvedValue([resident]);
    const page = vi.fn().mockResolvedValue({ items: [], total: 60 });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: GuardianApiService, useValue: { page } },
        { provide: ResidentApiService, useValue: { list } },
        {
          provide: DemoSessionService,
          useValue: { active: signal(false), scenario: signal('padrao'), hasRole: () => true },
        },
      ],
    });
    const fixture = TestBed.createComponent(GuardiansPage);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.changePage(1);
    component.residentFilter.setValue(resident.id);
    await vi.waitFor(() => expect(page).toHaveBeenCalledTimes(3));
    expect(list).toHaveBeenCalledOnce();
    expect(component.chips()).toEqual([
      { key: 'resident', label: 'Residente', value: 'Estudante Sintético · TESTE-001' },
    ]);
    component.removeFilter('resident');
    expect(component.residentFilter.value).toBe('');
  });
});

describe('Concorrência das buscas de responsáveis', () => {
  type Page = { items: GuardianRecord[]; total: number };
  const resident = { id: 'residente-teste', name: 'Estudante Sintético', enrollment: 'TESTE-001' };
  const bruno: GuardianRecord = {
    id: 'bruno',
    residentId: resident.id,
    name: 'Bruno Sintético',
    relationship: 'Pai',
    phone: null,
    active: true,
    version: 0,
  };
  let fixture: ComponentFixture<GuardiansPage>;
  let page: ReturnType<typeof vi.fn>;

  const pendingPage = () => {
    let resolve!: (page: Page) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Page>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  };

  beforeEach(async () => {
    page = vi.fn().mockResolvedValue({ items: [], total: 0 });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: GuardianApiService, useValue: { page } },
        { provide: ResidentApiService, useValue: { list: vi.fn().mockResolvedValue([resident]) } },
        {
          provide: DemoSessionService,
          useValue: { active: signal(false), scenario: signal('padrao'), hasRole: () => true },
        },
      ],
    });
    fixture = TestBed.createComponent(GuardiansPage);
    await fixture.whenStable();
  });

  function search(query: string) {
    fixture.componentInstance.search.setValue(query, { emitEvent: false });
    return fixture.componentInstance.load();
  }

  it('mantém Bruno quando a consulta anterior por Ana falha depois do sucesso atual', async () => {
    const old = pendingPage();
    page.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ items: [bruno], total: 1 });
    const first = search('ana');
    await search('bruno');
    old.reject(new Error('500 da consulta antiga'));
    await first;
    expect(fixture.componentInstance.localGuardians()).toEqual([bruno]);
    expect(fixture.componentInstance.residents()).toEqual([resident]);
    expect(fixture.componentInstance.remoteTotal()).toBe(1);
    expect(fixture.componentInstance.loadError()).toBe(false);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it.each(['success', 'failure'])(
    'uma conclusão antiga (%s) não encerra o carregamento atual',
    async (result) => {
      const old = pendingPage();
      const current = pendingPage();
      page.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
      const first = search('ana');
      const second = search('bruno');
      if (result === 'failure') old.reject(new Error('falha antiga'));
      else old.resolve({ items: [{ ...bruno, id: 'ana', name: 'Ana Sintética' }], total: 1 });
      await first;
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.loadError()).toBe(false);
      expect(fixture.componentInstance.localGuardians()).toEqual([]);
      current.resolve({ items: [bruno], total: 1 });
      await second;
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.localGuardians()).toEqual([bruno]);
    },
  );

  it('continua apresentando falhas da consulta atual', async () => {
    page.mockResolvedValueOnce({ items: [bruno], total: 1 });
    await search('bruno');
    page.mockRejectedValueOnce(new Error('falha atual'));
    await search('ana');
    expect(fixture.componentInstance.loadError()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.localGuardians()).toEqual([]);
  });

  it('não altera sinais após a destruição do componente', async () => {
    const pending = pendingPage();
    page.mockReturnValueOnce(pending.promise);
    const request = search('ana');
    fixture.destroy();
    pending.reject(new Error('falha após destruição'));
    await request;
    expect(fixture.componentInstance.loadError()).toBe(false);
    expect(fixture.componentInstance.loading()).toBe(true);
  });
});
