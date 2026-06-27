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
      { path: 'projects', loadComponent: () => import('./features/projects/projects').then(m => m.Projects) },
      { path: 'jobs', loadComponent: () => import('./features/jobs/jobs').then(m => m.Jobs) },
      { path: 'backups/:jobId', loadComponent: () => import('./features/backups/backups').then(m => m.Backups) },
      { path: 'history', loadComponent: () => import('./features/history/history').then(m => m.History) },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings-layout').then(m => m.SettingsLayout),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'destinations' },
          { path: 'destinations', loadComponent: () => import('./features/destinations/destinations').then(m => m.Destinations) },
          { path: 'agents', loadComponent: () => import('./features/agents/agents').then(m => m.Agents) },
          { path: 'notifications', loadComponent: () => import('./features/settings/settings').then(m => m.Settings) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
