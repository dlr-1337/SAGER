import { UnsavedForms } from './shared/unsaved-form';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DemoSessionService, type DemoScenario, type Role } from './core/demo-session.service';
import { LocalAuthService } from './core/local-auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  groupStart?: boolean;
}

// Menu em três grupos, como no design aprovado: rotina, cadastros e consultas, conta e apoio.
const registryPaths = [
  '/residentes',
  '/responsaveis',
  '/cursos',
  '/supervisores',
  '/quartos',
  '/relatorios',
  '/saude/acessos',
];
const navGroup = (path: string) =>
  path === '/perfil' || path === '/ajuda' ? 2 : registryPaths.includes(path) ? 1 : 0;
const grouped = (items: NavItem[]): NavItem[] =>
  [...items]
    .sort((a, b) => navGroup(a.path) - navGroup(b.path))
    .map((item, index, all) => ({
      ...item,
      groupStart: index > 0 && navGroup(item.path) !== navGroup(all[index - 1].path),
    }));

const roleLabels: Record<Role, string> = {
  gestor: 'Gestão',
  supervisor: 'Supervisão',
  residente: 'Residente',
  saude: 'Saúde',
};

const commonItems: NavItem[] = [{ label: 'Início', path: '/inicio', icon: 'home' }];

const residentItem: NavItem = { label: 'Residentes', path: '/residentes', icon: 'groups' };
const guardianItem: NavItem = {
  label: 'Responsáveis',
  path: '/responsaveis',
  icon: 'family_restroom',
};
const supervisorItem: NavItem = {
  label: 'Supervisores',
  path: '/supervisores',
  icon: 'supervisor_account',
};
const roomItem: NavItem = { label: 'Quartos', path: '/quartos', icon: 'bed' };

const supervisorItems: NavItem[] = [
  residentItem,
  { label: 'Saídas e retornos', path: '/saidas', icon: 'move_item' },
  { label: 'Notificações', path: '/notificacoes', icon: 'notifications' },
];

const navByRole: Record<Role, NavItem[]> = {
  gestor: [
    ...commonItems,
    residentItem,
    guardianItem,
    { label: 'Cursos', path: '/cursos', icon: 'school' },
    supervisorItem,
    roomItem,
    { label: 'Relatórios', path: '/relatorios', icon: 'description' },
    { label: 'Ajuda', path: '/ajuda', icon: 'help' },
  ],
  supervisor: [
    ...commonItems,
    ...supervisorItems,
    guardianItem,
    { label: 'Cursos', path: '/cursos', icon: 'school' },
    supervisorItem,
    roomItem,
    { label: 'Chamada noturna', path: '/chamada', icon: 'bedtime' },
    { label: 'Limpeza', path: '/limpeza', icon: 'cleaning_services' },
    { label: 'Relatórios', path: '/relatorios', icon: 'description' },
    { label: 'Ajuda', path: '/ajuda', icon: 'help' },
  ],
  residente: [
    ...commonItems,
    { label: 'Minhas saídas', path: '/saidas', icon: 'move_item' },
    { label: 'Avisos e advertências', path: '/avisos', icon: 'notifications' },
    { label: 'Ranking', path: '/ranking', icon: 'leaderboard' },
    { label: 'Meu perfil', path: '/perfil', icon: 'person' },
    { label: 'Ajuda', path: '/ajuda', icon: 'help' },
  ],
  saude: [
    ...commonItems,
    { label: 'Saúde', path: '/saude', icon: 'health_and_safety' },
    { label: 'Meu perfil', path: '/perfil', icon: 'person' },
    { label: 'Ajuda', path: '/ajuda', icon: 'help' },
  ],
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkTrapFocus],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  @ViewChild('menuButton') private menuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
  readonly session = inject(DemoSessionService);
  private readonly auth = inject(LocalAuthService);
  private readonly drafts = inject(UnsavedForms);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly publicPage = signal(false);
  readonly healthAccessPage = signal(false);
  readonly exitError = signal('');
  readonly isMobile = signal(false);
  readonly menuOpen = signal(false);
  readonly drawerActive = computed(() => this.isMobile() && this.menuOpen());
  readonly navItems = computed(() => {
    const role = this.session.role();
    const items = navByRole[role];
    if (this.session.active()) return grouped(items);
    const localItems =
      role === 'residente'
        ? items.map((item) =>
            item.path === '/avisos' ? { ...item, label: 'Minhas comunicações' } : item,
          )
        : items;
    const communicationItems: NavItem[] =
      role === 'supervisor'
        ? [
            { label: 'Advertências', path: '/advertencias', icon: 'assignment' },
            { label: 'Avisos institucionais', path: '/comunicacoes/avisos', icon: 'campaign' },
          ]
        : [];
    const cleaningItems: NavItem[] =
      role === 'residente'
        ? [{ label: 'Minha limpeza', path: '/minha-limpeza', icon: 'cleaning_services' }]
        : role === 'gestor'
          ? [
              { label: 'Limpeza', path: '/limpeza', icon: 'cleaning_services' },
              { label: 'Ranking', path: '/ranking', icon: 'leaderboard' },
            ]
          : role === 'supervisor'
            ? [{ label: 'Ranking', path: '/ranking', icon: 'leaderboard' }]
            : [];
    // Gestão não dá acesso ao conteúdo de saúde: /saude exige habilitação profissional.
    const healthProfessional = this.auth.principal()?.perfis.includes('saude') ?? false;
    const healthItems: NavItem[] =
      role === 'gestor' || role === 'supervisor'
        ? [
            ...(healthProfessional
              ? [{ label: 'Saúde', path: '/saude', icon: 'health_and_safety' }]
              : []),
            { label: 'Acessos de saúde', path: '/saude/acessos', icon: 'admin_panel_settings' },
          ]
        : role === 'residente'
          ? [{ label: 'Minha saúde', path: '/minha-saude', icon: 'health_and_safety' }]
          : [];
    return grouped([
      ...localItems.slice(0, -1),
      ...communicationItems,
      ...cleaningItems,
      ...healthItems,
      localItems[localItems.length - 1],
    ]);
  });
  readonly userName = computed(() =>
    this.session.active() ? '' : (this.auth.principal()?.nome ?? ''),
  );
  readonly roleLabel = computed(() => roleLabels[this.session.role()]);
  private previousBodyOverflow: string | null = null;
  private previousHtmlOverflow: string | null = null;
  private focusContentAfterNavigation = false;

  constructor() {
    this.isMobile.set(this.breakpointObserver.isMatched('(max-width: 800px)'));
    this.breakpointObserver
      .observe('(max-width: 800px)')
      .pipe(takeUntilDestroyed())
      .subscribe(({ matches }) => {
        if (!matches && this.menuOpen()) this.closeMenu(false);
        this.isMobile.set(matches);
      });
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.updatePageVisibility();
        if (this.menuOpen()) this.closeMenu(false);
        if (this.focusContentAfterNavigation) {
          this.focusContentAfterNavigation = false;
          setTimeout(() => this.document.getElementById('conteudo-principal')?.focus(), 0);
        }
      });
    queueMicrotask(() => this.updatePageVisibility());
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  async setRoleFromSelect(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'gestor' || value === 'supervisor' || value === 'residente') {
      if (!(await this.drafts.canLeave())) {
        (event.target as HTMLSelectElement).value = this.session.role();
        return;
      }
      this.drafts.discardAll();
      if (this.drawerActive()) this.navigateFromMenu();
      this.session.setRole(value);
      void this.router.navigateByUrl('/inicio');
    }
  }

  setScenarioFromSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'padrao' || value === 'vazio' || value === 'erro' || value === 'carregando') {
      this.session.setScenario(value as DemoScenario);
    }
  }

  async signOut(): Promise<void> {
    this.exitError.set('');
    if (!(await this.drafts.canLeave())) return;
    if (!this.session.active()) {
      try {
        await this.auth.logout();
      } catch {
        this.exitError.set('Não foi possível encerrar a sessão local. Tente novamente.');
        return;
      }
    }
    this.drafts.discardAll();
    this.session.deactivate();
    if (this.drawerActive()) this.navigateFromMenu();
    await this.router.navigateByUrl('/acesso');
  }

  toggleMenu(): void {
    if (!this.isMobile()) return;
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    this.lockScroll();
    setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
  }

  closeMenu(restoreFocus = true): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.unlockScroll();
    if (restoreFocus) setTimeout(() => this.menuButton?.nativeElement.focus(), 0);
  }

  navigateFromMenu(): void {
    if (!this.drawerActive()) return;
    this.focusContentAfterNavigation = true;
    this.closeMenu(false);
    setTimeout(() => {
      if (this.focusContentAfterNavigation) {
        this.focusContentAfterNavigation = false;
        this.document.getElementById('conteudo-principal')?.focus();
      }
    }, 100);
  }

  skipToContent(event: MouseEvent): void {
    event.preventDefault();
    const target = this.document.getElementById('conteudo-principal');
    target?.focus();
    target?.scrollIntoView({ block: 'start' });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawerActive()) this.closeMenu();
  }

  private lockScroll(): void {
    if (this.previousBodyOverflow !== null) return;
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.previousHtmlOverflow = this.document.documentElement.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.document.documentElement.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (this.previousBodyOverflow === null) return;
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.document.documentElement.style.overflow = this.previousHtmlOverflow ?? '';
    this.previousBodyOverflow = null;
    this.previousHtmlOverflow = null;
  }

  private updatePageVisibility(): void {
    let route = this.router.routerState.snapshot.root;
    let isPublic = false;
    while (route) {
      isPublic ||= route.data['public'] === true;
      if (!route.firstChild) break;
      route = route.firstChild;
    }
    const path = this.router.url.split('?')[0];
    this.healthAccessPage.set(path === '/saude/acessos');
    this.publicPage.set(isPublic || /^\/(acesso|demonstracao|ajuda|assinatura)(\/|$)/.test(path));
  }
}
