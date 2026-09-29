import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { DemoSessionService, Role } from './core/demo-session.service';
import { LocalAuthService } from './core/local-auth.service';
import { MANAGEMENT_ROUTES } from './features/management/management.routes';
import { OPERATIONS_ROUTES } from './features/operations/operations.routes';

const accessGuard: CanActivateFn = async (route) => {
  const session = inject(DemoSessionService);
  const auth = inject(LocalAuthService);
  const router = inject(Router);
  if (!session.active() && !(await auth.refresh())) return router.createUrlTree(['/acesso']);
  const allowed = route.data['roles'] as Role[] | undefined;
  return !allowed || session.hasRole(...allowed) || router.createUrlTree(['/acesso-negado']);
};

const managementRoutes: Routes = MANAGEMENT_ROUTES.map((route) => {
  const roles: Role[] = [
    'alojamentos',
    'alojamentos/:id',
    'residentes',
    'residentes/:id',
    'responsaveis',
    'responsaveis/:id',
    'quartos',
    'quartos/:id',
  ].includes(route.path ?? '')
    ? ['gestor', 'supervisor']
    : ['gestor'];
  return { ...route, canActivate: [accessGuard], data: { ...route.data, roles } };
});
const operationRoutes: Routes = OPERATIONS_ROUTES.map((route) => {
  let roles: Role[] = ['supervisor'];
  if (route.path?.startsWith('saidas'))
    roles =
      route.path === 'saidas/nova' || route.path?.endsWith('/editar')
        ? ['residente']
        : ['supervisor', 'residente'];
  if (route.path === 'ranking') roles = ['residente', 'supervisor', 'gestor'];
  return { ...route, canActivate: [accessGuard], data: { ...route.data, roles } };
});

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'acesso' },
  {
    path: 'acesso',
    data: { public: true },
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.AccessPage),
  },
  {
    path: 'demonstracao',
    data: { public: true },
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.DemoSelectorPage),
  },
  {
    path: 'inicio',
    canActivate: [accessGuard],
    loadComponent: () => import('./features/portal/portal.pages').then((m) => m.HomePage),
  },
  ...managementRoutes,
  ...operationRoutes,
  {
    path: 'avisos',
    canActivate: [accessGuard],
    data: { roles: ['residente'] satisfies Role[] },
    loadComponent: () =>
      import('./features/communications/notices.page').then((m) => m.NoticesPage),
  },
  {
    path: 'relatorios',
    canActivate: [accessGuard],
    data: { roles: ['gestor', 'supervisor'] satisfies Role[] },
    loadComponent: () => import('./features/reports/reports.pages').then((m) => m.ReportsPage),
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
    path: 'assinatura/:token',
    data: { public: true },
    loadComponent: () => import('./features/signature/signature.page').then((m) => m.SignaturePage),
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
