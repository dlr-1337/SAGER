import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocalAuthService } from '../../core/local-auth.service';
import { LocalHomePage } from './local-home.page';
import { HelpPage, ProfilePage } from './portal.pages';

describe('LocalHomePage', () => {
  it('na conta local usa atividades autorizadas sem contagens fictícias', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const auth = TestBed.inject(LocalAuthService);
    auth.principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['supervisor'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(LocalHomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Supervisora Sintética');
    expect(element.querySelector('a[href="/chamada"]')).not.toBeNull();
    expect(element.querySelector('a[href="/saidas"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Dados fictícios');
    expect(element.textContent).not.toContain('22h30');
    auth.principal.set({ ...auth.principal()!, perfis: ['residente'] });
    await fixture.whenStable();
    expect(element.querySelector('a[href="/chamada"]')).toBeNull();
    expect(element.querySelector('a[href="/residentes"]')).toBeNull();
    expect(element.querySelector('a[href="/minha-saude"]')).toBeNull();
  });

  it('apresenta a jornada de saúde sem ações pessoais de residente', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Profissional Sintética',
      email: 'saude@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['saude'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(LocalHomePage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('a[href="/saude"]')).toBeTruthy();
    expect(page.textContent).toContain('Atendimento de saúde');
    expect(page.textContent).not.toContain('Minhas saídas');
  });
});

describe('ProfilePage', () => {
  it('explica a habilitação separada para a conta de saúde', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Profissional Sintética',
      email: 'saude@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['saude'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Área de saúde');
    expect(fixture.nativeElement.textContent).not.toContain('ainda não está ligada a um cadastro');
  });
  it('apresenta o vínculo explícito da conta residente e informa quando ele está ausente', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const auth = TestBed.inject(LocalAuthService);
    const linked = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Pessoa Sintética',
      email: 'residente@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['residente' as const],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    };
    auth.principal.set(linked);
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('ligada ao seu cadastro de residente');
    expect(fixture.nativeElement.textContent).not.toContain(linked.residenteId);
    const unlinked = { ...linked, residenteId: null };
    auth.principal.set(unlinked);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('ainda não está ligada a um cadastro');
    expect(fixture.nativeElement.textContent).not.toContain(linked.residenteId);
  });
});

describe('HelpPage', () => {
  it('orienta a conta autenticada e limita os guias às tarefas do perfil', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const auth = TestBed.inject(LocalAuthService);
    auth.principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: 'residente@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['residente'],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Usar sua conta SAGER');
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();
    expect(page.querySelector('a[href="/chamada"]')).toBeNull();
    expect(page.querySelector('a[href="/relatorios"]')).toBeNull();
    expect(page.textContent).toContain('Alguém da equipe');
    auth.principal.set({ ...auth.principal()!, perfis: ['supervisor'] });
    await fixture.whenStable();
    expect(page.querySelector('a[href="/chamada"]')).not.toBeNull();
    expect(page.querySelector('a[href="/relatorios"]')).not.toBeNull();
  });
});
