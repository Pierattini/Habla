import { Routes } from '@angular/router';
import { professionalGuard } from './core/guards/professional.guard';
import { adminGuard } from './core/guards/admin.guard';
import { appUserGuard } from './core/guards/app-user.guard';

export const routes: Routes = [

  // ðŸ” LOGIN
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./pages/legal/legal-page.component').then(m => m.LegalPageComponent)
  },

  {
    path: 'terms',
    loadComponent: () =>
      import('./pages/legal/legal-page.component').then(m => m.LegalPageComponent)
  },

  {
    path: 'cookies',
    loadComponent: () =>
      import('./pages/legal/legal-page.component').then(m => m.LegalPageComponent)
  },

  {
    path: 'delete-account',
    loadComponent: () =>
      import('./pages/account-delete-public/account-delete-public.component')
        .then(m => m.AccountDeletePublicComponent)
  },

  // ðŸ“± TABS
  {
    path: 'tabs',
    canActivate: [appUserGuard],
    loadComponent: () =>
      import('./pages/tabs/tabs.component').then(m => m.TabsComponent),
    children: [

      // ðŸ  HOME
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.component').then(m => m.HomePage),
      },

      // ðŸ“… CITAS USUARIO
      {
        path: 'appointments',
        loadComponent: () =>
          import('./pages/my-appointments/my-appointments.component')
            .then(m => m.MyAppointmentsComponent),
      },

      // ðŸ‘¤ PERFIL USUARIO (ðŸ”¥ ESTE ES EL CORRECTO)
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component')
            .then(m => m.ProfileComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./pages/support/support.component')
            .then(m => m.SupportComponent),
      },
      {
        path: 'account/delete',
        loadComponent: () =>
          import('./pages/account-delete/account-delete.component')
            .then(m => m.AccountDeleteComponent),
      },
      {
        path: 'admin-support',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin-support/admin-support.component')
            .then(m => m.AdminSupportComponent),
      },

      // ðŸ§‘â€âš•ï¸ DETALLE PROFESIONAL
      {
        path: 'professional/:id',
        loadComponent: () =>
          import('./pages/professional-detail/professional-detail.component')
            .then(m => m.ProfessionalDetailComponent),
      },

      // ðŸ§‘â€âš•ï¸ DASHBOARD PROFESIONAL (separado)
      {
        path: 'professional-dashboard',
        canActivate: [professionalGuard],
        loadComponent: () =>
          import('./pages/professional-dashboard/professional-dashboard.component')
            .then(m => m.ProfessionalDashboardComponent),
      },
      {
        path: 'tax-documents',
        canActivate: [professionalGuard],
        loadComponent: () =>
          import('./pages/tax-documents/tax-documents.component')
            .then(m => m.TaxDocumentsComponent),
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
      // ðŸ”¥ DEFAULT TAB
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      }
    ]
  },

  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-layout/admin-layout.component')
        .then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.component')
            .then(m => m.AdminDashboardComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./pages/admin-support/admin-support.component')
            .then(m => m.AdminSupportComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin-users/admin-users.component')
            .then(m => m.AdminUsersComponent),
      },
      {
        path: 'professionals',
        loadComponent: () =>
          import('./pages/admin-professionals/admin-professionals.component')
            .then(m => m.AdminProfessionalsComponent),
      },
      {
        path: 'messages/:id',
        loadComponent: () =>
          import('./pages/chat-detail/chat-detail.component')
            .then(m => m.ChatDetailComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },


  {
    path: 'profesional/:slug',
    loadComponent: () =>
      import('./pages/public-professional/public-professional.component')
        .then(m => m.PublicProfessionalComponent),
  },
  {
    path: 'meeting/:appointmentId/:token',
    loadComponent: () =>
      import('./pages/meeting/meeting.component')
        .then(m => m.MeetingComponent),
  },
  // ðŸ”¥ INICIO
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // ðŸ” fallback
  {
    path: '**',
    redirectTo: 'login'
  }
];



