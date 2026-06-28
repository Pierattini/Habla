import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminAttentionMode,
  AdminProfessional,
  AdminService,
} from '../../services/admin.service';

interface ProfessionalAdminDraft {
  name: string | null;
  specialty: string | null;
  attentionMode: AdminAttentionMode;
  city: string | null;
  country: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-admin-professionals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-professionals.component.html',
  styleUrls: ['./admin-professionals.component.scss'],
})
export class AdminProfessionalsComponent {
  professionals: AdminProfessional[] = [];
  loading = true;
  errorMessage = '';
  search = '';
  country = '';
  attentionMode = '';
  planStatus = '';
  subscriptionStatus = '';
  isActive = '';
  page = 1;
  limit = 12;
  total = 0;
  totalPages = 1;
  editingId = '';
  draft: ProfessionalAdminDraft = this.emptyDraft();

  readonly modes: Array<AdminAttentionMode | ''> = ['', 'ONLINE', 'PRESENTIAL', 'BOTH'];
  readonly planStatuses = ['', 'FREE', 'ACTIVE', 'SUSPENDED', 'CANCELLED'];
  readonly subscriptionStatuses = ['', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page): void {
    this.page = page;
    this.loading = true;
    this.errorMessage = '';

    this.adminService.getProfessionals({
      page: this.page,
      limit: this.limit,
      search: this.search,
      country: this.country,
      attentionMode: this.attentionMode,
      planStatus: this.planStatus,
      subscriptionStatus: this.subscriptionStatus,
      isActive: this.isActive,
    }).subscribe({
      next: (res) => {
        this.professionals = res.data;
        this.total = res.total;
        this.totalPages = res.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudieron cargar los profesionales.';
        this.loading = false;
      },
    });
  }

  resetAndLoad(): void {
    this.load(1);
  }

  startEdit(professional: AdminProfessional): void {
    this.editingId = professional.id;
    this.draft = {
      name: professional.name || professional.user.name,
      specialty: this.getSpecialty(professional),
      attentionMode: professional.attentionMode,
      city: professional.officeCity,
      country: professional.officeCountry || professional.user.country,
      isActive: professional.user.isActive,
    };
  }

  cancelEdit(): void {
    this.editingId = '';
    this.draft = this.emptyDraft();
  }

  save(professional: AdminProfessional): void {
    this.adminService.updateProfessional(professional.id, { ...this.draft }).subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudo actualizar el profesional.';
      },
    });
  }

  suspend(professional: AdminProfessional): void {
    this.adminService.suspendProfessional(professional.id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudo suspender el profesional.';
      },
    });
  }

  activate(professional: AdminProfessional): void {
    this.adminService.activateProfessional(professional.id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudo activar el profesional.';
      },
    });
  }

  getSpecialty(professional: AdminProfessional): string {
    return professional.profession?.name ||
      professional.customProfession ||
      professional.specialty ||
      'Sin especialidad';
  }

  getModeLabel(mode: string): string {
    const labels: Record<string, string> = {
      ONLINE: 'Online',
      PRESENTIAL: 'Presencial',
      BOTH: 'Mixta',
    };

    return mode ? labels[mode] || mode : 'Todas';
  }

  getPages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, start + 4);

    for (let current = start; current <= end; current++) {
      pages.push(current);
    }

    return pages;
  }

  private emptyDraft(): ProfessionalAdminDraft {
    return {
      name: null,
      specialty: null,
      attentionMode: 'ONLINE',
      city: null,
      country: null,
      isActive: false,
    };
  }
}
