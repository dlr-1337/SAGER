import { Routes } from '@angular/router';

export const OPERATIONS_ROUTES: Routes = [
  { path: 'chamada', loadComponent: () => import('./night-call.component').then((m) => m.NightCallComponent) },
  { path: 'saidas/nova', loadComponent: () => import('./exit-form.component').then((m) => m.ExitFormComponent) },
  { path: 'saidas/:id/editar', loadComponent: () => import('./exit-form.component').then((m) => m.ExitFormComponent) },
  { path: 'saidas/:id', loadComponent: () => import('./exit-detail.component').then((m) => m.ExitDetailComponent) },
  { path: 'saidas', loadComponent: () => import('./exits.component').then((m) => m.ExitsComponent) },
  { path: 'notificacoes/:id', loadComponent: () => import('./notification-detail.component').then((m) => m.NotificationDetailComponent) },
  { path: 'notificacoes', loadComponent: () => import('./notifications.component').then((m) => m.NotificationsComponent) },
  { path: 'limpeza', loadComponent: () => import('./cleaning.component').then((m) => m.CleaningComponent) },
  { path: 'ranking', loadComponent: () => import('./ranking.component').then((m) => m.RankingComponent) },
];
