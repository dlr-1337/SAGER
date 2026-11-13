import { unsavedFormGuard } from './shared/unsaved-form';
import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { DemoSessionService, Role } from './core/demo-session.service';
import { LocalAuthService } from './core/local-auth.service';
import { MANAGEMENT_ROUTES } from './features/management/management.routes';
import { OPERATIONS_ROUTES } from './features/operations/operations.routes';
import { COMMUNICATION_ROUTES } from './features/communications/communications.routes';

const accessGuard: CanActivateFn = async (route) => {
  const session = inject(DemoSessionService);
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
    path: 'demonstracao',
    canActivate: [
      () => inject(DemoSessionService).demoAvailable || inject(Router).createUrlTree(['/acesso']),
    ],
    data: { public: true },
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.DemoSelectorPage),
  },
  {
    path: 'inicio',
    canActivate: [accessGuard],
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.HomePage),
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
