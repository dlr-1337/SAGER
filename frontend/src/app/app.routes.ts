import { unsavedFormGuard } from './shared/unsaved-form';
import { Injector, inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { SessionService, Role } from './core/session.service';
import { LocalAuthService } from './core/local-auth.service';
import { firstValueFrom } from 'rxjs';
import { MANAGEMENT_ROUTES } from './features/management/management.routes';
import { OPERATIONS_ROUTES } from './features/operations/operations.routes';
import { COMMUNICATION_ROUTES } from './features/communications/communications.routes';

const accessGuard: CanActivateFn = async (route) => {
  const session = inject(SessionService);
  const auth = inject(LocalAuthService);
  const router = inject(Router);
  if (!session.active() && !(await auth.refresh())) return router.createUrlTree(['/acesso']);
  const allowed = route.data['roles'] as Role[] | undefined;
  return !allowed || session.hasRole(...allowed) || router.createUrlTree(['/acesso-negado']);
};

const managementRoutes: Routes = MANAGEMENT_ROUTES.map((route) => ({
  ...route,
  canActivate: [accessGuard],
  data: {
    ...route.data,
    roles: route.path?.startsWith('supervisores')
      ? (['gestor'] satisfies Role[])
      : (['gestor', 'supervisor'] satisfies Role[]),
  },
}));

const healthGuard: CanActivateFn = async (route) => {
  const session = inject(SessionService);
  const auth = inject(LocalAuthService);
  const injector = inject(Injector);
  const router = inject(Router);
  if (session.active()) return router.createUrlTree(['/acesso-negado']);
  if (!(await auth.refresh())) return router.createUrlTree(['/acesso']);
  try {
    // Keep the health contract in its lazy feature; capture DI before awaiting.
    const { HealthApiService } = await import('./features/health/health-api.service');
    const api = injector.get(HealthApiService);
    const capabilities = await firstValueFrom(api.getMe());
    const access = route.data['healthAccess'] as 'admin' | 'professional' | 'own';
    const allowed =
      access === 'admin'
        ? capabilities.canAdministerAccess
        : access === 'own'
          ? capabilities.canAccessOwnRecord
          : !!capabilities.professionalGrant;
    return allowed || router.createUrlTree(['/acesso-negado']);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
      auth.clearPrincipal();
      return router.createUrlTree(['/acesso']);
    }
    if (error && typeof error === 'object' && 'status' in error && error.status === 403) {
      return router.createUrlTree(['/acesso-negado']);
    }
    // A transport failure opens only the page's explicit error state. The API
    // checks the current professional grant and record permission on every call.
    return true;
  }
};

const healthRoutes: Routes = [
  {
    path: 'saude/acessos',
    canActivate: [healthGuard],
    data: { healthAccess: 'admin' },
    loadComponent: () => import('./features/health/health.pages').then((m) => m.HealthAccessPage),
  },
  {
    path: 'saude',
    canActivate: [healthGuard],
    data: { healthAccess: 'professional' },
    loadComponent: () =>
      import('./features/health/health.pages').then((m) => m.HealthResidentsPage),
  },
  {
    path: 'saude/residentes/:id',
    canActivate: [healthGuard],
    data: { healthAccess: 'professional' },
    loadComponent: () => import('./features/health/health.pages').then((m) => m.HealthResidentPage),
  },
  {
    path: 'saude/notas/:id',
    canActivate: [healthGuard],
    data: { healthAccess: 'professional' },
    loadComponent: () => import('./features/health/health.pages').then((m) => m.HealthNotePage),
  },
  {
    path: 'minha-saude',
    canActivate: [healthGuard],
    data: { healthAccess: 'own' },
    loadComponent: () => import('./features/health/health.pages').then((m) => m.OwnHealthPage),
  },
];
const operationRoutes: Routes = OPERATIONS_ROUTES.map((route) => {
  let roles: Role[] = ['supervisor'];
  if (route.path?.startsWith('saidas'))
    roles =
      route.path?.endsWith('/nova') || route.path?.endsWith('/editar')
        ? ['residente']
        : ['supervisor', 'residente'];
  if (route.path === 'ranking') roles = ['residente', 'supervisor', 'gestor'];
  if (route.path === 'limpeza') roles = ['supervisor', 'gestor'];
  if (route.path === 'limpeza')
    route = {
      ...route,
      loadComponent: () =>
        import('./features/cleaning/cleaning-local.pages').then((m) => m.CleaningPage),
    };
  if (route.path === 'ranking')
    route = {
      ...route,
      loadComponent: () =>
        import('./features/cleaning/cleaning-local.pages').then((m) => m.RankingPage),
    };
  return { ...route, canActivate: [accessGuard], data: { ...route.data, roles } };
});

const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'acesso' },
  {
    path: 'acesso',
    data: { public: true },
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.AccessPage),
  },
  {
    path: 'recuperar-senha',
    data: { public: true },
    loadComponent: () => import('./features/portal/recovery.page').then((m) => m.RecoveryPage),
  },
  {
    path: 'inicio',
    canActivate: [accessGuard],
    loadComponent: () => import('./features/portal/local-home.page').then((m) => m.LocalHomePage),
  },
  ...managementRoutes,
  {
    path: 'limpeza/nova',
    canActivate: [accessGuard],
    data: { roles: ['supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/cleaning/cleaning-form-local.page').then((m) => m.CleaningFormLocalPage),
  },
  {
    path: 'limpeza/:id/corrigir',
    canActivate: [accessGuard],
    data: { roles: ['supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/cleaning/cleaning-form-local.page').then((m) => m.CleaningFormLocalPage),
  },
  {
    path: 'limpeza/:id',
    canActivate: [accessGuard],
    data: { roles: ['gestor', 'supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/cleaning/cleaning-local.pages').then((m) => m.CleaningDetailLocalPage),
  },
  {
    path: 'minha-limpeza/:id',
    canActivate: [accessGuard],
    data: { roles: ['residente'] satisfies Role[], ownCleaning: true },
    loadComponent: () =>
      import('./features/cleaning/cleaning-local.pages').then((m) => m.CleaningDetailLocalPage),
  },
  {
    path: 'minha-limpeza',
    canActivate: [accessGuard],
    data: { roles: ['residente'] satisfies Role[], ownCleaning: true },
    loadComponent: () =>
      import('./features/cleaning/cleaning-local.pages').then((m) => m.CleaningListLocalPage),
  },
  ...operationRoutes,
  ...COMMUNICATION_ROUTES.map((route) => ({ ...route, canActivate: [accessGuard] })),
  ...healthRoutes,
  {
    path: 'avisos',
    canActivate: [accessGuard],
    data: { roles: ['residente'] satisfies Role[] },
    loadComponent: () =>
      import('./features/communications/notices.page').then((m) => m.NoticesPage),
  },
  {
    path: 'relatorios/consultas/:id',
    canActivate: [accessGuard],
    data: { roles: ['gestor', 'supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/reports/reports-local.pages').then((m) => m.ReportSnapshotLocalPage),
  },
  {
    path: 'relatorios/individual',
    canActivate: [accessGuard],
    data: { roles: ['gestor', 'supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/cleaning/cleaning-indicators-local.page').then(
        (m) => m.CleaningIndicatorsLocalPage,
      ),
  },
  {
    path: 'relatorios',
    canActivate: [accessGuard],
    data: { roles: ['gestor', 'supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/reports/reports-local.pages').then((m) => m.ReportsLocalPage),
  },
  {
    path: 'relatorios/individual/:id',
    canActivate: [accessGuard],
    data: { roles: ['gestor', 'supervisor'] satisfies Role[] },
    loadComponent: () =>
      import('./features/reports/reports.pages').then((m) => m.IndividualReportPage),
  },
  {
    path: 'perfil',
    canActivate: [accessGuard],
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.ProfilePage),
  },
  {
    path: 'ajuda',
    data: { public: true },
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.HelpPage),
  },
  {
    path: 'acesso-negado',
    canActivate: [accessGuard],
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.DeniedPage),
  },
  {
    path: '**',
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.NotFoundPage),
  },
];

export const routes: Routes = appRoutes.map((route) => ({
  ...route,
  canDeactivate: [...(route.canDeactivate ?? []), unsavedFormGuard],
}));
