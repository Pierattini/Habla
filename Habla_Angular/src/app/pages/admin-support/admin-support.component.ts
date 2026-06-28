import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  SupportAdminService,
  SupportSummary,
  SupportTicket,
  SupportTicketStatus,
} from '../../services/support-admin.service';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-support.component.html',
  styleUrls: ['./admin-support.component.scss'],
})
export class AdminSupportComponent {
  tickets: SupportTicket[] = [];
  summary: SupportSummary = {
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
  };
  loading = true;
  loaded = false;
  errorMessage = '';
  statusFilter: SupportTicketStatus | '' = '';
  updatingTicketId = '';

  readonly statuses: Array<SupportTicketStatus | ''> = [
    '',
    'OPEN',
    'IN_PROGRESS',
    'CLOSED',
  ];

  constructor(
    private supportAdminService: SupportAdminService,
    private router: Router,
  ) {}

  ionViewWillEnter(): void {
    this.loadSummary();
    this.loadTickets();
  }

  loadSummary(): void {
    this.supportAdminService.getSummary().subscribe({
      next: (summary) => {
        this.summary = summary;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  loadTickets(): void {
    this.loading = true;
    this.loaded = false;
    this.errorMessage = '';

    this.supportAdminService.getTickets(this.statusFilter).subscribe({
      next: (tickets) => {
        this.tickets = tickets ?? [];
        this.loading = false;
        this.loaded = true;
        this.loadSummary();
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message || 'No se pudieron cargar los tickets.';
        this.tickets = [];
        this.loading = false;
        this.loaded = true;
      },
    });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter = value as SupportTicketStatus | '';
    this.loadTickets();
  }

  updateStatus(ticket: SupportTicket, status: SupportTicketStatus): void {
    if (ticket.status === status || this.updatingTicketId) return;

    this.updatingTicketId = ticket.id;
    this.errorMessage = '';

    this.supportAdminService.updateTicketStatus(ticket.id, status).subscribe({
      next: () => {
        this.updatingTicketId = '';
        this.loadSummary();
        this.loadTickets();
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message || 'No se pudo actualizar el ticket.';
        this.updatingTicketId = '';
      },
    });
  }

  openConversation(ticket: SupportTicket): void {
    this.router.navigate(['/admin/messages', ticket.conversationId]);
  }

  getStatusLabel(status: SupportTicketStatus | ''): string {
    const labels: Record<SupportTicketStatus, string> = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En progreso',
      CLOSED: 'Cerrado',
    };

    return status ? labels[status] : 'Todos';
  }

  getCustomerName(ticket: SupportTicket): string {
    return ticket.customer?.name || ticket.customer?.email || 'Usuario';
  }

  getLastMessage(ticket: SupportTicket): string {
    return ticket.lastMessage?.content || 'Sin mensajes recientes';
  }

  getLastMessageDate(ticket: SupportTicket): string | null {
    return ticket.lastMessage?.createdAt || null;
  }

  isUpdating(ticket: SupportTicket): boolean {
    return this.updatingTicketId === ticket.id;
  }
}
