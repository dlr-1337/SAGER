import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { HelpPage, HomePage, ProfilePage } from './portal.pages';

describe('HomePage', () => {
  it('na conta local usa atividades autorizadas sem contagens demonstrativas', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    const auth = TestBed.inject(LocalAuthService);
    session.deactivate();
    auth.principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
      fotoUrl: null,
      perfis: ['supervisor'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Supervisora Sintética');
    expect(element.querySelector('a[href="/chamada"]')).not.toBeNull();
    expect(element.querySelector('a[href="/saidas"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Cenário de demonstração');
    expect(element.textContent).not.toContain('Dados fictícios');
    expect(element.textContent).not.toContain('22h30');
    auth.principal.set({ ...auth.principal()!, perfis: ['residente'] });
    await fixture.whenStable();
    expect(element.querySelector('a[href="/chamada"]')).toBeNull();
    expect(element.querySelector('a[href="/residentes"]')).toBeNull();
    expect(element.querySelector('a[href="/minha-saude"]')).not.toBeNull();
  });

  it('apresenta a jornada de saúde sem ações pessoais de residente', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Profissional Sintética',
      email: 'saude@example.test',
      fotoUrl: null,
      perfis: ['saude'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('a[href="/saude"]')).toBeTruthy();
    expect(page.textContent).toContain('Atendimento de saúde');
    expect(page.textContent).not.toContain('Minhas saídas');
  });
  it('mostra contagens que acompanham os registros e não antecipa a análise de saída longa', () => {
    const home = TestBed.runInInjectionContext(() => new HomePage());
    const operations = TestBed.inject(OperationsDemoService);
    const session = TestBed.inject(DemoSessionService);

    expect(home.pendingExitCount()).toBe(1);
    expect(home.shortReturnCount()).toBe(1);
    expect(home.notificationCount()).toBe(2);

    operations.exits.update((items) =>
      items.map((item) => (item.id === 'S-1045' ? { ...item, status: 'Aprovada' } : item)),
    );
    operations.exits.update((items) =>
      items.map((item) =>
        item.id === 'S-1048' ? { ...item, status: 'Aguardando análise' } : item,
      ),
    );
    expect(home.pendingExitCount()).toBe(0);

    operations.exits.update((items) =>
      items.map((item) => (item.id === 'S-1048' ? { ...item, signed: true } : item)),
    );
    expect(home.pendingExitCount()).toBe(1);

    operations.notifications.update((items) =>
      items.map((item) => ({ ...item, status: 'Arquivada' })),
    );
    expect(home.notificationCount()).toBe(0);

    session.setScenario('erro');
    expect(home.countsAvailable()).toBe(false);
  });
});

describe('ProfilePage', () => {
  it('explica a habilitação separada para a conta de saúde', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Profissional Sintética',
      email: 'saude@example.test',
      fotoUrl: null,
      perfis: ['saude'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Acesso assistencial');
    expect(fixture.nativeElement.textContent).not.toContain('Conta sem cadastro vinculado');
  });
  it('apresenta o vínculo explícito da conta residente e informa quando ele está ausente', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    const auth = TestBed.inject(LocalAuthService);
    const linked = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Pessoa Sintética',
      email: 'residente@example.test',
      fotoUrl: null,
      perfis: ['residente' as const],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    };
    auth.principal.set(linked);
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cadastro de residente vinculado');
    expect(fixture.nativeElement.textContent).toContain(linked.residenteId);
    const unlinked = { ...linked, residenteId: null };
    auth.principal.set(unlinked);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Conta sem cadastro vinculado');
    expect(fixture.nativeElement.textContent).not.toContain(linked.residenteId);
  });
});

describe('HelpPage', () => {
  it('orienta a conta autenticada e limita os guias às tarefas do perfil', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    const auth = TestBed.inject(LocalAuthService);
    auth.principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: 'residente@example.test',
      fotoUrl: null,
      perfis: ['residente'],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Usar sua conta SAGER');
    expect(page.querySelector('a[href="/demonstracao"]')).toBeNull();
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();
    expect(page.querySelector('a[href="/chamada"]')).toBeNull();
    expect(page.querySelector('a[href="/relatorios"]')).toBeNull();
    expect(page.textContent).toContain('operador autorizado');
    auth.principal.set({ ...auth.principal()!, perfis: ['supervisor'] });
    await fixture.whenStable();
    expect(page.querySelector('a[href="/chamada"]')).not.toBeNull();
    expect(page.querySelector('a[href="/relatorios"]')).not.toBeNull();
  });
});
