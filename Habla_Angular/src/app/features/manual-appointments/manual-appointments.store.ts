import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/config/api.config';
import { CustomerSearchResult, ManualAppointment } from './manual-appointments.models';

@Injectable({ providedIn: 'root' })
export class ManualAppointmentsStore {
  private readonly http = inject(HttpClient);
  readonly customers = signal<CustomerSearchResult[]>([]);
  readonly selectedCustomer = signal<CustomerSearchResult | null>(null);
  readonly selectedDate = signal('');
  readonly availableSlots = signal<string[]>([]);
  readonly selectedSlot = signal('');
  readonly selectedServiceId = signal<string | null>(null);
  readonly searchingCustomers = signal(false);
  readonly loadingSlots = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  async searchCustomers(query: string): Promise<void> {
    const term = query.trim();
    this.error.set(null);
    if (term.length < 2) { this.customers.set([]); return; }
    this.searchingCustomers.set(true);
    try {
      this.customers.set(await firstValueFrom(this.http.get<CustomerSearchResult[]>(
        `${API_URL}/users/customers/search`, { params: new HttpParams().set('q', term) },
      )));
    } catch { this.error.set('No pudimos buscar pacientes. Inténtalo nuevamente.'); }
    finally { this.searchingCustomers.set(false); }
  }

  selectCustomer(customer: CustomerSearchResult): void {
    this.selectedCustomer.set(customer);
    this.customers.set([]);
    this.error.set(null);
  }

  async loadSlots(date: string): Promise<void> {
    this.selectedDate.set(date); this.selectedSlot.set(''); this.availableSlots.set([]); this.error.set(null);
    if (!date) return;
    this.loadingSlots.set(true);
    try {
      let params = new HttpParams().set('date', date);
      if (this.selectedServiceId()) {
        params = params.set('serviceId', this.selectedServiceId()!);
      }
      this.availableSlots.set(await firstValueFrom(this.http.get<string[]>(
        `${API_URL}/appointments/manual/available-slots`, { params },
      )));
    } catch { this.error.set('No pudimos cargar los horarios. Inténtalo nuevamente.'); }
    finally { this.loadingSlots.set(false); }
  }

  async createAppointment(): Promise<ManualAppointment | null> {
    const customer = this.selectedCustomer(); const date = this.selectedDate(); const slot = this.selectedSlot();
    if (!customer || !date || !slot || this.creating()) return null;
    this.creating.set(true); this.error.set(null); this.success.set(null);
    try {
      const startAt = new Date(`${date}T${slot}:00`).toISOString();
      const payload = {
        customerId: customer.id,
        startAt,
        ...(this.selectedServiceId() ? { serviceId: this.selectedServiceId()! } : {}),
      };
      const created = await firstValueFrom(this.http.post<ManualAppointment>(
        `${API_URL}/appointments/manual`, payload,
      ));
      this.success.set('Cita creada correctamente.');
      this.availableSlots.update((slots) => slots.filter((value) => value !== slot));
      this.selectedSlot.set('');
      return created;
    } catch (error) { this.error.set(this.friendlyError(error)); return null; }
    finally { this.creating.set(false); }
  }

  reset(): void {
    this.customers.set([]); this.selectedCustomer.set(null); this.selectedDate.set('');
    this.availableSlots.set([]); this.selectedSlot.set(''); this.selectedServiceId.set(null); this.error.set(null); this.success.set(null);
  }

  async selectService(serviceId: string | null): Promise<void> {
    this.selectedServiceId.set(serviceId || null);
    this.selectedSlot.set('');
    this.availableSlots.set([]);
    if (this.selectedDate()) await this.loadSlots(this.selectedDate());
  }

  clearMessages(): void { this.error.set(null); this.success.set(null); }

  private friendlyError(error: unknown): string {
    const response = error instanceof HttpErrorResponse ? error.error : null;
    const raw = String(Array.isArray(response?.message) ? response.message.join(' ') : response?.message || '').toLowerCase();
    if (raw.includes('disponib') || raw.includes('bloque') || raw.includes('solapa') || (error instanceof HttpErrorResponse && error.status === 409)) {
      return 'Ese horario acaba de dejar de estar disponible. Selecciona otro.';
    }
    if (raw.includes('paciente') || raw.includes('customer')) return 'El paciente seleccionado no está disponible.';
    return 'No pudimos crear la cita. Inténtalo nuevamente.';
  }
}
