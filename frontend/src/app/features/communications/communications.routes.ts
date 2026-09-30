import { Routes } from '@angular/router';

export const COMMUNICATION_ROUTES: Routes = [
  {
    path: 'advertencias/nova',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./warnings-local.pages').then((m) => m.WarningFormLocalPage),
  },
  {
    path: 'advertencias/:id',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./warnings-local.pages').then((m) => m.WarningDetailLocalPage),
  },
  {
    path: 'advertencias',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./warnings-local.pages').then((m) => m.WarningsLocalPage),
  },
  {
    path: 'residentes/:id/reincidencias',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./recurrence-local.pages').then((m) => m.RecurrenceLocalPage),
  },
  {
    path: 'termos/:id',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./recurrence-local.pages').then((m) => m.TermDetailLocalPage),
  },
  {
    path: 'comunicacoes/avisos/novo',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./notices-local.pages').then((m) => m.NoticeFormLocalPage),
  },
  {
    path: 'comunicacoes/avisos/:id',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./notices-local.pages').then((m) => m.NoticeDetailLocalPage),
  },
  {
    path: 'comunicacoes/avisos',
    data: { roles: ['supervisor'] },
    loadComponent: () => import('./notices-local.pages').then((m) => m.NoticesManagementLocalPage),
  },
  {
    path: 'minhas-comunicacoes/:id',
    data: { roles: ['residente'] },
    loadComponent: () =>
      import('./own-communications-local.pages').then((m) => m.OwnCommunicationDetailLocalPage),
  },
];
