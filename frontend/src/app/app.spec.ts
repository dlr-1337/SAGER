import { vi } from 'vitest';
import { UnsavedForms } from './shared/unsaved-form';
import { TestBed } from '@angular/core/testing';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  provideRouter,
  Router,
} from '@angular/router';
import { Subject } from 'rxjs';
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

  it('agrupa o menu em rotina, cadastros e apoio, com separador no início de cada grupo', async () => {
    TestBed.inject(DemoSessionService).deactivate();
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
    TestBed.inject(DemoSessionService).deactivate();
    const logout = vi.spyOn(TestBed.inject(LocalAuthService), 'logout').mockResolvedValue();
    vi.spyOn(TestBed.inject(UnsavedForms), 'canLeave').mockResolvedValue(false);
    const fixture = TestBed.createComponent(App);
    await fixture.componentInstance.signOut();
    expect(logout).not.toHaveBeenCalled();
  });

  it('mostra a barra e marca o conteúdo como ocupado enquanto a tela carrega', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const events = TestBed.inject(Router).events as Subject<RouterEvent>;
    const element = fixture.nativeElement as HTMLElement;
    const state = () => {
      fixture.detectChanges();
      return [
        !!element.querySelector('.navigation-bar[aria-hidden="true"]'),
        element.querySelector('#conteudo-principal')?.getAttribute('aria-busy') ?? null,
      ];
    };
    expect(state()).toEqual([false, null]);
    const ends = [
      new NavigationEnd(1, '/residentes', '/residentes'),
      new NavigationCancel(2, '/residentes', 'guarda'),
      new NavigationError(3, '/residentes', new Error('falhou')),
    ];
    for (const end of ends) {
      events.next(new NavigationStart(end.id, '/residentes'));
      expect(state()).toEqual([true, 'true']);
      events.next(end);
      expect(state()).toEqual([false, null]);
    }
  });
});
