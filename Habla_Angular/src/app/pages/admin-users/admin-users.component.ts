import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminRole, AdminService, AdminUser } from '../../services/admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent {
  users: AdminUser[] = [];
  loading = true;
  errorMessage = '';
  search = '';
  role = '';
  country = '';
  isActive = '';
  page = 1;
  limit = 12;
  total = 0;
  totalPages = 1;
  editingId = '';
  draft: Partial<AdminUser> = {};

  readonly roles: Array<AdminRole | ''> = ['', 'CUSTOMER', 'PROFESSIONAL', 'ADMIN'];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page): void {
    this.page = page;
    this.loading = true;
    this.errorMessage = '';

    this.adminService.getUsers({
      page: this.page,
      limit: this.limit,
      search: this.search,
      role: this.role,
      country: this.country,
      isActive: this.isActive,
    }).subscribe({
      next: (res) => {
        this.users = res.data;
        this.total = res.total;
        this.totalPages = res.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudieron cargar los usuarios.';
        this.loading = false;
      },
    });
  }

  resetAndLoad(): void {
    this.load(1);
  }

  startEdit(user: AdminUser): void {
    this.editingId = user.id;
    this.draft = {
      name: user.name,
      email: user.email,
      role: user.role,
      country: user.country,
      isActive: user.isActive,
    };
  }

  cancelEdit(): void {
    this.editingId = '';
    this.draft = {};
  }

  save(user: AdminUser): void {
    this.adminService.updateUser(user.id, this.draft).subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudo actualizar el usuario.';
      },
    });
  }

  toggleActive(user: AdminUser): void {
    this.adminService.setUserActive(user.id, !user.isActive).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudo cambiar el estado.';
      },
    });
  }

  getRoleLabel(role: AdminRole | ''): string {
    const labels: Record<AdminRole, string> = {
      CUSTOMER: 'Paciente',
      PROFESSIONAL: 'Profesional',
      ADMIN: 'Administrador',
    };

    return role ? labels[role] : 'Todos';
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
}
