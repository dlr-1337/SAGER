import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { DemoSessionService } from './core/demo-session.service';
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
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toEqual([
      '/inicio',
      '/saude',
      '/perfil',
      '/ajuda',
    ]);
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
    TestBed.inject(DemoSessionService).deactivate();
    const auth = TestBed.inject(LocalAuthService);
    const account = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
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
    auth.principal.set({ ...account, perfis: ['gestor'] });
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
});
