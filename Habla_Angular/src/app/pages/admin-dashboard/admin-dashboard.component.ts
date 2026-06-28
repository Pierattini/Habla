import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
  metrics: AdminMetric[] = this.buildMetrics();
  loading = true;
  errorMessage = '';

  readonly modules = [
    'Usuarios',
    'Profesionales',
    'Citas',
    'Solicitudes',
    'Pagos',
    'Catalogo',
    'Notificaciones',
    'Reportes',
    'Configuracion',
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.getSummary().subscribe({
      next: (summary) => {
        this.metrics = this.buildMetrics(summary);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar las metricas administrativas.';
        this.loading = false;
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
