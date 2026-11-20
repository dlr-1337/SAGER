import { TestBed } from '@angular/core/testing';
import { routes } from '../../app.routes';
import { provideRouter } from '@angular/router';
import { DemoSessionService } from '../../core/demo-session.service';
import { LocalAuthService } from '../../core/local-auth.service';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { afterEach, vi } from 'vitest';
import { AccessPage, HelpPage, HomePage, ProfilePage, roomLine } from './portal.pages';

afterEach(() => vi.unstubAllGlobals());

const syntheticResident = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Pessoa Sintética',
  email: null,
  matricula: 'TESTE-LOGIN',
  fotoUrl: null,
  perfis: ['residente' as const],
  residenteId: '00000000-0000-0000-0000-000000000002',
  supervisorId: null,
};

describe('AccessPage', () => {
  it('pede o usuário, diz ao residente que é a matrícula e fala de usuário nos erros', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    const login = vi.spyOn(TestBed.inject(LocalAuthService), 'login').mockResolvedValue('invalid');
    const fixture = TestBed.createComponent(AccessPage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const input = page.querySelector<HTMLInputElement>('#login-enrollment')!;

    expect(page.querySelector('label[for="login-enrollment"]')?.textContent?.trim()).toBe(
      'Usuário',
    );
    const hint = page.querySelector(`#${input.getAttribute('aria-describedby')}`);
    expect(hint?.textContent?.trim()).toBe('Residente: use sua matrícula.');
    expect(page.querySelector('.lead')?.textContent).toContain('usuário');
    expect(page.querySelector('.lead')?.textContent).not.toContain('matrícula');

    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toBe('Informe seu usuário e senha.');
    expect(login).not.toHaveBeenCalled();

    fixture.componentInstance.form.setValue({
      matricula: ' gestor-01 ',
      password: 'senha de teste',
    });
    await fixture.componentInstance.submit();
    expect(login).toHaveBeenCalledWith('gestor-01', 'senha de teste');
    expect(fixture.componentInstance.error()).toMatch(/^Usuário ou senha errados\./);
  });
});

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
      matricula: 'TESTE-LOGIN',
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

  it('o início da demonstração do supervisor continua com a próxima atividade e as pendências', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    session.activate('supervisor');
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Próxima atividade');
    expect(page.textContent).toContain('Pendências para revisar');
    session.deactivate();
  });
});

describe('ProfilePage', () => {
  async function openProfile(
    principal: Parameters<LocalAuthService['principal']['set']>[0],
    me: () => Promise<Response> = () => new Promise(() => undefined),
  ) {
    const fetchMock = vi.fn(me);
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    TestBed.inject(LocalAuthService).principal.set(principal);
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    const panel = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('.profile-panel span')].map(
        (span) => span.textContent!.trim(),
      );
    return { fixture, fetchMock, panel };
  }

  it('monta o quarto com alojamento, casa quando houver e número', () => {
    expect(roomLine({ alojamento: 'R2', casa: 'Casa 3', numero: '43' })).toBe(
      'R2 · Casa 3 · Quarto 43',
    );
    expect(roomLine({ alojamento: 'R2', casa: null, numero: '43' })).toBe('R2 · Quarto 43');
    expect(roomLine({ casa: 'Bloco A', numero: '102' })).toBe('Bloco A · Quarto 102');
  });

  it('mostra o quarto do residente abaixo da matrícula', async () => {
    const withHouse = await openProfile({
      ...syntheticResident,
      quarto: { alojamento: 'R2', casa: 'Casa 3', numero: '43' },
    });
    expect(withHouse.panel()).toEqual(['person', 'TESTE-LOGIN', 'R2 · Casa 3 · Quarto 43']);
    expect(withHouse.fetchMock).toHaveBeenCalledWith('/api/v1/auth/me', expect.anything());
    TestBed.resetTestingModule();
    const withoutHouse = await openProfile({
      ...syntheticResident,
      quarto: { alojamento: 'R2', casa: null, numero: '43' },
    });
    expect(withoutHouse.panel()).toContain('R2 · Quarto 43');
  });

  it('não mostra linha de quarto ao residente sem alocação nem ao supervisor', async () => {
    for (const principal of [
      { ...syntheticResident, quarto: null },
      syntheticResident,
      {
        ...syntheticResident,
        perfis: ['supervisor' as const],
        residenteId: null,
        supervisorId: '00000000-0000-0000-0000-000000000003',
      },
    ]) {
      const { panel } = await openProfile(principal);
      expect(panel().some((text) => text.includes('Quarto'))).toBe(false);
      TestBed.resetTestingModule();
    }
  });

  it('consulta a conta ao abrir e mostra o quarto depois da transferência', async () => {
    const { fixture, panel } = await openProfile(
      { ...syntheticResident, quarto: { alojamento: 'R2', casa: null, numero: '43' } },
      async () =>
        new Response(
          JSON.stringify({
            ...syntheticResident,
            quarto: { alojamento: 'R2', casa: null, numero: '44' },
          }),
        ),
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(panel()).toContain('R2 · Quarto 44');
    });
  });

  it('mantém o quarto mostrado quando a consulta da conta falha', async () => {
    const { fixture, fetchMock, panel } = await openProfile(
      { ...syntheticResident, quarto: { alojamento: 'R2', casa: null, numero: '43' } },
      () => Promise.reject(new TypeError('rede fora')),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await fixture.whenStable();
    expect(panel()).toContain('R2 · Quarto 43');
    expect(TestBed.inject(LocalAuthService).principal()).not.toBeNull();
  });

  it('na demonstração, só o residente vê o quarto fictício, sem chamar a API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    const shown: Record<string, string[]> = {};
    for (const role of ['gestor', 'supervisor', 'residente'] as const) {
      session.activate(role);
      const fixture = TestBed.createComponent(ProfilePage);
      await fixture.whenStable();
      shown[role] = [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll('.profile-panel span'),
      ]
        .map((span) => span.textContent!.trim())
        .filter((text) => text.includes('Quarto'));
      fixture.destroy();
    }
    expect(shown).toEqual({ gestor: [], supervisor: [], residente: ['Bloco A · Quarto 102'] });
    expect(fetchMock).not.toHaveBeenCalled();
    session.deactivate();
  });

  it('apresenta o vínculo explícito da conta residente e informa quando ele está ausente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
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
  async function openHelp(principal: Parameters<LocalAuthService['principal']['set']>[0]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
    TestBed.inject(LocalAuthService).principal.set(principal);
    const fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  const supervisor = {
    ...syntheticResident,
    perfis: ['supervisor' as const],
    residenteId: null,
    supervisorId: '00000000-0000-0000-0000-000000000003',
  };
  const whatsappQuestion = 'Por que um arquivo da conversa não tem o botão Vincular?';

  it('o visitante sem conta lê quando a saída começa, antes de quem confirma o retorno', async () => {
    const page = await openHelp(null);
    const questions = [...page.querySelectorAll('.faq summary')].map((item) =>
      item.textContent!.trim(),
    );
    const start = questions.indexOf('Quando a saída começa?');
    expect(start).toBeGreaterThan(-1);
    expect(questions[start + 1]).toBe('Quem confirma o retorno de uma saída curta?');
    expect(page.textContent).toContain(
      'A saída curta é sempre para agora: depois de pedir, vá até o supervisor quando quiser sair. Ela começa quando ele vê você e registra a saída. Na saída longa, a aprovação não registra a saída: ela começa quando o supervisor registra a partida.',
    );
    expect(page.textContent).not.toContain('a partir do horário pedido');
    expect(page.textContent).not.toContain(whatsappQuestion);
  });

  it('o guia do supervisor traz os passos da saída longa e da limpeza', async () => {
    const page = await openHelp(supervisor);
    const steps = (selector: string) =>
      [...page.querySelectorAll(`${selector} ol > li strong`)].map((item) =>
        item.textContent!.trim(),
      );
    expect(steps('.long-exit-steps')).toEqual([
      'Autorização do responsável.',
      'Decisão.',
      'Saída.',
      'Volta.',
    ]);
    expect(steps('.cleaning-steps')).toEqual(['Qual quarto?', 'Notas.', 'Conferir e salvar.']);
    const longExit = page.querySelector('.long-exit-steps')!.textContent!;
    for (const name of [
      'Baixar arquivo',
      'Confirmar conferência',
      'Recusar arquivo',
      'Anexar arquivo',
      'Registrar saída',
      'Registrar volta',
    ])
      expect(longExit).toContain(name);
    expect(longExit).toContain('Aprovar não registra a saída.');
    expect(longExit).not.toContain('já registra a saída');
    expect(page.textContent).toContain(whatsappQuestion);
    expect(page.textContent).toContain(
      'Ele já está numa saída longa; Abrir saída mostra a situação.',
    );
    expect(page.textContent).not.toContain('conferir ou recusar');
    expect(page.textContent).toContain(
      'As telas se atualizam sozinhas; não precisa recarregar a página.',
    );
  });

  it('o guia de cores lista os cinco tons e nenhum guia fala em Atualizar dados ou Marcação', async () => {
    const page = await openHelp(supervisor);
    const tones = [...page.querySelectorAll('.color-guide .status')].map((item) => [
      item.textContent!.trim(),
      item.getAttribute('data-tone'),
    ]);
    expect(tones).toEqual([
      ['Amarelo', 'warning'],
      ['Azul', 'info'],
      ['Verde', 'success'],
      ['Vermelho', 'danger'],
      ['Cinza', null],
    ]);
    expect(page.querySelector('.filter-guide')?.textContent).toContain('Mais filtros');
    expect(page.textContent).not.toContain('Atualizar dados');
    expect(page.textContent).not.toContain('Marcação');
  });

  it('gestor e residente não veem os passos do supervisor nem a pergunta da conversa', async () => {
    for (const principal of [{ ...supervisor, perfis: ['gestor' as const] }, syntheticResident]) {
      const page = await openHelp(principal);
      expect(page.querySelector('.long-exit-steps')).toBeNull();
      expect(page.querySelector('.cleaning-steps')).toBeNull();
      expect(page.querySelector('.color-guide')).not.toBeNull();
      expect(page.textContent).not.toContain(whatsappQuestion);
      TestBed.resetTestingModule();
    }
  });

  it('a demonstração do supervisor não tem os guias da conta nem a pergunta da conversa', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    session.activate('supervisor');
    const fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.long-exit-steps')).toBeNull();
    expect(page.querySelector('.color-guide')).toBeNull();
    expect(page.textContent).not.toContain(whatsappQuestion);
    expect(page.textContent).toContain('Quando a saída começa?');
    // A demonstração segue a monografia: a saída começa a partir do horário pedido.
    expect(page.textContent).toContain(
      'A saída começa quando o supervisor vê o residente e registra a saída, a partir do horário pedido. A aprovação não registra a saída.',
    );
    expect(page.textContent).not.toContain('A saída curta é sempre para agora');
    session.deactivate();
  });

  it('orienta a conta autenticada e limita os guias às tarefas do perfil', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(DemoSessionService).deactivate();
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
    expect(page.textContent).toContain(
      'Entre com seu usuário e a senha do SAGER; o residente usa a matrícula.',
    );
    expect(page.querySelector('a[href="/demonstracao"]')).toBeNull();
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();
    expect(page.querySelector('a[href="/chamada"]')).toBeNull();
    expect(page.querySelector('a[href="/relatorios"]')).toBeNull();
    expect(page.textContent).toContain('procure o suporte da instituição');
    auth.principal.set({ ...auth.principal()!, perfis: ['supervisor'] });
    await fixture.whenStable();
    expect(page.querySelector('a[href="/chamada"]')).not.toBeNull();
    expect(page.querySelector('a[href="/relatorios"]')).not.toBeNull();
  });

  it('manda o residente à recuperação, servidores ao suporte, e mantém a pergunta da demonstração', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    session.deactivate();
    const fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const recovery = page.querySelector('a[href="/recuperar-senha"]');
    expect(recovery?.textContent).toContain('Esqueci minha senha');
    expect(page.textContent).toContain('Gestor ou supervisor: procure o suporte da instituição');
    expect(page.textContent).not.toContain('Esta demonstração usa dados reais?');

    session.activate('residente');
    await fixture.whenStable();
    expect(page.textContent).toContain('Esta demonstração usa dados reais?');
    expect(page.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    session.deactivate();
  });

  it('na demonstração, cada guia leva a uma rota do perfil em uso', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    const fixture = TestBed.createComponent(HelpPage);
    const page = fixture.nativeElement as HTMLElement;
    const shown: Record<string, string[]> = {};
    for (const role of ['gestor', 'supervisor', 'residente'] as const) {
      session.activate(role);
      await fixture.whenStable();
      shown[role] = [...page.querySelectorAll('.guide-grid a')].map((a) => a.getAttribute('href')!);
      for (const href of shown[role]) {
        const route = routes.find((item) => `/${item.path}` === href);
        const allowed = route?.data?.['roles'] as string[] | undefined;
        expect(route && (!allowed || allowed.includes(role)), `${role} ${href}`).toBe(true);
      }
    }
    expect(shown).toEqual({
      gestor: ['/relatorios'],
      supervisor: ['/chamada', '/saidas', '/relatorios'],
      residente: ['/saidas', '/avisos', '/ranking'],
    });
    session.deactivate();
  });

  it('tira o guia de saídas só do residente maior de idade', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const session = TestBed.inject(DemoSessionService);
    session.deactivate();
    const auth = TestBed.inject(LocalAuthService);
    const resident = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: null,
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['residente' as const],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    };
    auth.principal.set({ ...resident, maiorDeIdade: true });
    const fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('a[href="/saidas"]')).toBeNull();
    expect(page.querySelector('a[href="/avisos"]')).not.toBeNull();
    auth.principal.set({ ...resident, maiorDeIdade: false });
    await fixture.whenStable();
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();
    auth.principal.set(null);
    session.activate('residente');
    await fixture.whenStable();
    expect(page.textContent).toContain('Acompanhar saídas');
    expect(page.querySelector('a[href="/saidas"]')).not.toBeNull();
    session.deactivate();
  });
});
