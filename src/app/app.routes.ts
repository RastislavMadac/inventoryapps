import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    // ✅ Správne Standalone načítanie
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'inventury-zoznam', // 👈 OPRAVENÉ (bolo 'invetura')
    loadComponent: () => import('./pages/inventury-zoznam/inventury-zoznam.page').then(m => m.InventuryZoznamPage)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },

  // Tu sme vymazali duplicitné riadky, ktoré tam boli navyše
];