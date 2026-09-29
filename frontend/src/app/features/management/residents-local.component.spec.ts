import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoScenario, DemoSessionService, Role } from '../../core/demo-session.service';
import { ManagementDemoService } from './management-demo.service';
import { ResidentApiError, ResidentApiService, ResidentRecord } from './resident-api.service';
import { ResidentDetailComponent } from './resident-detail.component';
import { ResidentFormComponent } from './resident-form.component';
import { ResidentsComponent } from './residents.component';

const resident: ResidentRecord = {
  id: '00000000-0000-0000-0000-000000000041',
  name: 'Estudante Sintético',
  enrollment: 'TESTE-001',
  birthDate: null,
  course: null,
  version: 0,
};

describe('Residentes em sessão local', () => {
  const active = signal(false);
  const role = signal<Role>('gestor');
  const scenario = signal<DemoScenario>('padrao');
  const route = {
    snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
  };
  let api: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    active.set(false);
    role.set('gestor');
    scenario.set('padrao');
    route.snapshot.paramMap = convertToParamMap({});
    route.snapshot.queryParamMap = convertToParamMap({});
    api = {
      list: vi.fn().mockResolvedValue([structuredClone(resident)]),
      get: vi.fn().mockResolvedValue(structuredClone(resident)),
      save: vi.fn().mockResolvedValue(structuredClone(resident)),
    };
    await TestBed.configureTestingModule({
      imports: [ResidentsComponent, ResidentFormComponent, ResidentDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: ResidentApiService, useValue: api },
        {
          provide: DemoSessionService,
          useValue: {
            active,
            scenario,
            hasRole: (...roles: Role[]) => roles.includes(role()),
            setScenario: (value: DemoScenario) => scenario.set(value),
          },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('busca por nome e matrícula na API sem dados demonstrativos', async () => {
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estudante Sintético');
    expect(fixture.nativeElement.textContent).toContain('Não informado');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Luísa Ribeiro');
    expect(fixture.nativeElement.textContent).not.toContain('Sem quarto atribuído');
    fixture.componentInstance.localSearch.setValue('teste-001');
    expect(fixture.componentInstance.localFiltered()).toHaveLength(1);
    fixture.componentInstance.localSearch.setValue('outra matrícula');
    expect(fixture.componentInstance.localFiltered()).toHaveLength(0);
  });

  it('erro da API não exibe residentes da demonstração', async () => {
    api.list.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar residentes');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Luísa Ribeiro');
    expect(fixture.componentInstance.localResidents()).toEqual([]);
  });

  it('supervisor lê, mas não vê ação de cadastro', async () => {
    role.set('supervisor');
    const fixture = TestBed.createComponent(ResidentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estudante Sintético');
    expect(fixture.nativeElement.textContent).not.toContain('Cadastrar residente');
  });

  it('detalhe local trata campos ausentes sem inventar idade ou vínculos', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const guardians = vi.spyOn(TestBed.inject(ManagementDemoService), 'guardiansFor');
    const fixture = TestBed.createComponent(ResidentDetailComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estudante Sintético');
    expect(fixture.nativeElement.textContent).toContain('Não informado');
    expect(fixture.nativeElement.textContent).toContain(
      'A ausência da data de nascimento não indica maioridade',
    );
    expect(fixture.nativeElement.textContent).not.toContain('anos');
    fixture.componentInstance.tab.set('responsaveis');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ainda não integrado');
    expect(fixture.nativeElement.textContent).not.toContain('Mariana Ribeiro');
    expect(guardians).not.toHaveBeenCalled();
  });

  it('salva campos opcionais como null, preserva matrícula textual e bloqueia data futura', async () => {
    const fixture = TestBed.createComponent(ResidentFormComponent);
    const form = fixture.componentInstance.form;
    form.setValue({
      name: ' Estudante Sintético ',
      enrollment: ' TESTE-A1 ',
      birthDate: '',
      course: ' ',
    });
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledWith(
      { name: 'Estudante Sintético', enrollment: 'TESTE-A1', birthDate: null, course: null },
      undefined,
    );
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/residentes', resident.id], {
      queryParams: { saved: '1' },
    });
    api.save.mockClear();
    form.setValue({
      name: 'Pessoa Sintética',
      enrollment: 'ABC-2',
      birthDate: '2999-01-01',
      course: '',
    });
    await fixture.componentInstance.save();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('distingue duplicidade de versão obsoleta e recarrega a versão atual', async () => {
    route.snapshot.paramMap = convertToParamMap({ id: resident.id });
    const fixture = TestBed.createComponent(ResidentFormComponent);
    await fixture.whenStable();
    api.save.mockRejectedValueOnce(new ResidentApiError(409, 'duplicate_enrollment'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('Já existe um cadastro');
    expect(fixture.componentInstance.conflict()).toBe(false);
    api.save.mockRejectedValueOnce(new ResidentApiError(409, 'stale_version'));
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.error()).toContain('alterado por outra sessão');
    expect(fixture.componentInstance.conflict()).toBe(true);
    api.get.mockResolvedValueOnce({ ...resident, name: 'Versão Atual', version: 1 });
    await fixture.componentInstance.reloadLatest();
    expect(fixture.componentInstance.form.controls.name.value).toBe('Versão Atual');
    await fixture.componentInstance.save();
    expect(api.save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Versão Atual' }), {
      id: resident.id,
      version: 1,
    });
  });

  it('não redireciona quando um salvamento termina depois de cancelar', async () => {
    let finishSave!: (value: ResidentRecord) => void;
    api.save.mockImplementation(
      () => new Promise<ResidentRecord>((resolve) => (finishSave = resolve)),
    );
    const fixture = TestBed.createComponent(ResidentFormComponent);
    fixture.componentInstance.form.setValue({
      name: 'Pessoa Sintética',
      enrollment: 'TESTE-002',
      birthDate: '',
      course: '',
    });
    const saving = fixture.componentInstance.save();
    expect(api.save).toHaveBeenCalledOnce();
    fixture.destroy();
    finishSave(resident);
    await saving;
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('demonstração usa exclusivamente os registros em memória', async () => {
    active.set(true);
    const fixture = TestBed.createComponent(ResidentsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana Luísa Ribeiro');
    expect(api.list).not.toHaveBeenCalled();
  });
});
