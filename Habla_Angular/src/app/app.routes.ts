import { Routes } from '@angular/router';
import { professionalGuard } from './core/guards/professional.guard';

export const routes: Routes = [

  // 🔐 LOGIN
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent)
  },

  // 📱 TABS
  {
    path: 'tabs',
    loadComponent: () =>
      import('./pages/tabs/tabs.component').then(m => m.TabsComponent),
    children: [

      // 🏠 HOME
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.component').then(m => m.HomePage),
      },

      // 📅 CITAS USUARIO
      {
        path: 'appointments',
        loadComponent: () =>
          import('./pages/my-appointments/my-appointments.component')
            .then(m => m.MyAppointmentsComponent),
      },

      // 👤 PERFIL USUARIO (🔥 ESTE ES EL CORRECTO)
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component')
            .then(m => m.ProfileComponent),
      },

      // 🧑‍⚕️ DETALLE PROFESIONAL
      {
        path: 'professional/:id',
        loadComponent: () =>
          import('./pages/professional-detail/professional-detail.component')
            .then(m => m.ProfessionalDetailComponent),
      },

      // 🧑‍⚕️ DASHBOARD PROFESIONAL (separado)
      {
        path: 'professional-dashboard',
        canActivate: [professionalGuard],
        loadComponent: () =>
          import('./pages/professional-dashboard/professional-dashboard.component')
            .then(m => m.ProfessionalDashboardComponent),
      },
      {
  path: 'messages',
  loadComponent: () =>
    import('./pages/messages/messages.component').then(
      m => m.MessagesComponent
    ),
},
{
  path: 'messages/:id',
  loadComponent: () =>
    import('./pages/chat-detail/chat-detail.component').then(
      m => m.ChatDetailComponent
    ),
},
      // 🔥 DEFAULT TAB
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      }
    ]
  },

  // 🔥 INICIO
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // 🔁 fallback
  {
    path: '**',
    redirectTo: 'login'
  }
];
