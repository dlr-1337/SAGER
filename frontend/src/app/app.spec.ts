import { vi } from 'vitest';
import { UnsavedForms } from './shared/unsaved-form';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { SessionService } from './core/session.service';
import { LocalAuthService } from './core/local-auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('mantém a navegação de saúde sem recursos de gestão ou de residente', async () => {
    TestBed.inject(SessionService).deactivate();
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
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toEqual([
      '/inicio',
      '/saude',
      '/perfil',
      '/ajuda',
    ]);
  });

  it('agrupa o menu em rotina, cadastros e apoio, com separador no início de cada grupo', async () => {
    TestBed.inject(SessionService).deactivate();
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['supervisor'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const items = fixture.componentInstance.navItems();
    const paths = items.map((item) => item.path);
    expect(paths.indexOf('/chamada')).toBeLessThan(paths.indexOf('/residentes'));
    expect(paths.indexOf('/relatorios')).toBeLessThan(paths.indexOf('/ajuda'));
    expect(items.filter((item) => item.groupStart).map((item) => item.path)).toEqual([
      '/residentes',
      '/ajuda',
    ]);
    expect(fixture.componentInstance.userName()).toBe('Supervisora Sintética');
    // Saúde fica fora do menu da gestão; só a habilitação profissional mostra /saude.
    expect(paths).not.toContain('/saude');
    expect(paths).not.toContain('/saude/acessos');
    TestBed.inject(LocalAuthService).principal.update((account) =>
      account ? { ...account, perfis: ['supervisor', 'saude'] } : account,
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain('/saude');
  });

  it('identifica a demonstração e a marca no shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('SAGER');
    expect(compiled.textContent).toContain('Dados fictícios');
    expect(compiled.querySelector('img[alt*="Instituto Federal Goiano"]')).toBeTruthy();
  });

  it('oferece análise e avisos somente ao supervisor no acesso local', async () => {
    TestBed.inject(SessionService).deactivate();
    const auth = TestBed.inject(LocalAuthService);
    const account = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['supervisor' as const],
      residenteId: null,
      supervisorId: null,
    };
    auth.principal.set(account);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain(
      '/advertencias',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain(
      '/comunicacoes/avisos',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain('/conversas');
    expect(fixture.componentInstance.navItems().map((item) => item.path)).not.toContain(
      '/supervisores',
    );
    auth.principal.set({ ...account, perfis: ['gestor'] });
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain(
      '/supervisores',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).not.toContain(
      '/conversas',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain('/limpeza');
    expect(fixture.componentInstance.navItems().map((item) => item.path)).not.toContain(
      '/advertencias',
    );
    auth.principal.set({ ...account, perfis: ['residente'] });
    const ownItems = fixture.componentInstance.navItems();
    expect(ownItems.map((item) => item.path)).toContain('/minha-limpeza');
    expect(ownItems.map((item) => item.path)).not.toContain('/limpeza');
    expect(ownItems.find((item) => item.path === '/avisos')?.label).toBe('Minhas comunicações');
    expect(ownItems.map((item) => item.path)).not.toContain('/comunicacoes/avisos');
  });
  it('confirma alterações antes de encerrar a sessão', async () => {
    TestBed.inject(SessionService).deactivate();
    const logout = vi.spyOn(TestBed.inject(LocalAuthService), 'logout').mockResolvedValue();
    vi.spyOn(TestBed.inject(UnsavedForms), 'canLeave').mockResolvedValue(false);
    const fixture = TestBed.createComponent(App);
    await fixture.componentInstance.signOut();
    expect(logout).not.toHaveBeenCalled();
  });
});
