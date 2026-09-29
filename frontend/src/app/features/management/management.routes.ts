import { Routes } from '@angular/router';

export const MANAGEMENT_ROUTES: Routes = [
  {
    path: 'alojamentos',
    loadComponent: () =>
      import('./accommodations.component').then((m) => m.AccommodationsComponent),
  },
  {
    path: 'alojamentos/novo',
    loadComponent: () =>
      import('./accommodation-form.component').then((m) => m.AccommodationFormComponent),
  },
  {
    path: 'alojamentos/:id/editar',
    loadComponent: () =>
      import('./accommodation-form.component').then((m) => m.AccommodationFormComponent),
  },
  {
    path: 'alojamentos/:id',
    loadComponent: () =>
      import('./accommodation-detail.component').then((m) => m.AccommodationDetailComponent),
  },
  {
    path: 'residentes',
    loadComponent: () => import('./residents.component').then((m) => m.ResidentsComponent),
  },
  {
    path: 'residentes/novo',
    loadComponent: () => import('./resident-form.component').then((m) => m.ResidentFormComponent),
  },
  {
    path: 'residentes/:id/editar',
    loadComponent: () => import('./resident-form.component').then((m) => m.ResidentFormComponent),
  },
  {
    path: 'residentes/:id',
    loadComponent: () =>
      import('./resident-detail.component').then((m) => m.ResidentDetailComponent),
  },
  {
    path: 'responsaveis',
    loadComponent: () => import('./guardians.pages').then((m) => m.GuardiansPage),
  },
  {
    path: 'responsaveis/novo',
    loadComponent: () => import('./guardians.pages').then((m) => m.GuardianFormPage),
  },
  {
    path: 'responsaveis/:id/editar',
    loadComponent: () => import('./guardians.pages').then((m) => m.GuardianFormPage),
  },
  {
    path: 'responsaveis/:id',
    loadComponent: () => import('./guardians.pages').then((m) => m.GuardianDetailPage),
  },
  {
    path: 'supervisores',
    loadComponent: () => import('./supervisors.component').then((m) => m.SupervisorsComponent),
  },
  {
    path: 'supervisores/novo',
    loadComponent: () =>
      import('./supervisor-form.component').then((m) => m.SupervisorFormComponent),
  },
  {
    path: 'supervisores/:id/editar',
    loadComponent: () =>
      import('./supervisor-form.component').then((m) => m.SupervisorFormComponent),
  },
  {
    path: 'supervisores/:id',
    loadComponent: () =>
      import('./supervisor-detail.component').then((m) => m.SupervisorDetailComponent),
  },
  {
    path: 'quartos',
    loadComponent: () => import('./rooms.component').then((m) => m.RoomsComponent),
  },
  {
    path: 'quartos/novo',
    loadComponent: () => import('./room-form.component').then((m) => m.RoomFormComponent),
  },
  {
    path: 'quartos/:id/editar',
    loadComponent: () => import('./room-form.component').then((m) => m.RoomFormComponent),
  },
  {
    path: 'quartos/:id',
    loadComponent: () => import('./room-detail.component').then((m) => m.RoomDetailComponent),
  },
];
