import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then(m => m.Login),
  },
  {
    path: '',
    loadComponent: () => import('./features/shell/shell').then(m => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'sources', loadComponent: () => import('./features/sources/sources').then(m => m.Sources) },
      { path: 'destinations', loadComponent: () => import('./features/destinations/destinations').then(m => m.Destinations) },
      { path: 'jobs', loadComponent: () => import('./features/jobs/jobs').then(m => m.Jobs) },
      { path: 'backups/:jobId', loadComponent: () => import('./features/backups/backups').then(m => m.Backups) },
      { path: 'history', loadComponent: () => import('./features/history/history').then(m => m.History) },
      { path: 'agents', loadComponent: () => import('./features/agents/agents').then(m => m.Agents) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings').then(m => m.Settings) },
    ],
  },
  { path: '**', redirectTo: '' },
];
