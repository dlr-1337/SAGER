import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { DemoSessionService, Role } from './core/demo-session.service';
import { MANAGEMENT_ROUTES } from './features/management/management.routes';
import { OPERATIONS_ROUTES } from './features/operations/operations.routes';

const roleGuard: CanActivateFn = (route) => {
  const allowed = route.data['roles'] as Role[] | undefined;
  return !allowed || inject(DemoSessionService).hasRole(...allowed) || inject(Router).createUrlTree(['/acesso-negado']);
};

const managementRoutes: Routes = MANAGEMENT_ROUTES.map(route => {
  const roles: Role[] = ['residentes', 'residentes/:id', 'quartos', 'quartos/:id'].includes(route.path ?? '') ? ['gestor', 'supervisor'] : ['gestor'];
  return { ...route, canActivate: [roleGuard], data: { ...route.data, roles } };
});
const operationRoutes: Routes = OPERATIONS_ROUTES.map(route => {
  let roles: Role[] = ['supervisor'];
  if (route.path?.startsWith('saidas')) roles = route.path === 'saidas/nova' || route.path?.endsWith('/editar') ? ['residente'] : ['supervisor', 'residente'];
  if (route.path === 'ranking') roles = ['residente', 'supervisor', 'gestor'];
  return { ...route, canActivate: [roleGuard], data: { ...route.data, roles } };
});

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'acesso' },
  { path: 'acesso', data: { public: true }, loadComponent: () => import('./features/portal/portal.pages').then(m => m.AccessPage) },
  { path: 'demonstracao', data: { public: true }, loadComponent: () => import('./features/portal/portal.pages').then(m => m.DemoSelectorPage) },
  { path: 'inicio', loadComponent: () => import('./features/portal/portal.pages').then(m => m.HomePage) },
  ...managementRoutes,
  ...operationRoutes,
  { path: 'avisos', canActivate: [roleGuard], data: { roles: ['residente'] satisfies Role[] }, loadComponent: () => import('./features/communications/notices.page').then(m => m.NoticesPage) },
  { path: 'relatorios', canActivate: [roleGuard], data: { roles: ['gestor', 'supervisor'] satisfies Role[] }, loadComponent: () => import('./features/reports/reports.pages').then(m => m.ReportsPage) },
  { path: 'relatorios/individual/:id', canActivate: [roleGuard], data: { roles: ['gestor', 'supervisor'] satisfies Role[] }, loadComponent: () => import('./features/reports/reports.pages').then(m => m.IndividualReportPage) },
  { path: 'perfil', loadComponent: () => import('./features/portal/portal.pages').then(m => m.ProfilePage) },
  { path: 'ajuda', loadComponent: () => import('./features/portal/portal.pages').then(m => m.HelpPage) },
  { path: 'assinatura/:token', data: { public: true }, loadComponent: () => import('./features/signature/signature.page').then(m => m.SignaturePage) },
  { path: 'acesso-negado', loadComponent: () => import('./features/portal/portal.pages').then(m => m.DeniedPage) },
  { path: '**', loadComponent: () => import('./features/portal/portal.pages').then(m => m.NotFoundPage) },
];
