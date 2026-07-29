import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService, AdminSummary } from '../../services/admin.service';

interface AdminMetric {
  label: string;
  value: string;
  note: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent {
  readonly metrics = signal<AdminMetric[]>(this.buildMetrics());
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  readonly modules = [
    'Usuarios',
    'Profesionales',
    'Citas',
    'Solicitudes',
    'Pagos',
    'Catalogo',
    'Notificaciones',
    'Reportes',
    'Configuración',
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.getSummary().subscribe({
      next: (summary) => {
        console.log('[AdminDashboard] Respuesta recibida por el componente', summary);
        this.metrics.set(this.buildMetrics(summary));
        this.loading.set(false);
        console.log('[AdminDashboard] Estado antes del template', this.metrics());
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las metricas administrativas.');
        this.loading.set(false);
      },
    });
  }

  private buildMetrics(summary?: AdminSummary): AdminMetric[] {
    return [
      { label: 'Total usuarios', value: String(summary?.totalUsers ?? '—'), note: 'Pacientes, profesionales y admins' },
      { label: 'Profesionales', value: String(summary?.totalProfessionals ?? '—'), note: `CL ${summary?.countries?.CL ?? '—'} / ES ${summary?.countries?.ES ?? '—'}` },
      { label: 'Citas hoy', value: String(summary?.appointmentsToday ?? '—'), note: `${summary?.appointmentsThisWeek ?? '—'} esta semana` },
      { label: 'Citas confirmadas', value: String(summary?.confirmedAppointments ?? '—'), note: `${summary?.cancelledAppointments ?? '—'} canceladas` },
      { label: 'Profesionales premium', value: String(summary?.premiumProfessionals ?? '—'), note: `${summary?.activeProfessionals ?? '—'} activos` },
      { label: 'Solicitudes pendientes', value: String(summary?.pendingRequests ?? '—'), note: `${summary?.newUsersThisMonth ?? '—'} usuarios nuevos este mes` },
    ];
  }
}
