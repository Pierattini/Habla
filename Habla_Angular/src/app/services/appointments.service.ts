import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AppointmentsService {

  private api = 'http://localhost:3000';

  constructor(
    private http: HttpClient
  ) {}

  createAppointment(body: any) {
    return this.http.post(
      `${this.api}/appointments`,
      body
    );
  }

  getMyAppointments() {
    return this.http.get(
      `${this.api}/appointments/mine`
    );
  }

  getAppointmentsByRole(role: string | null) {
    let url = `${this.api}/appointments/mine`;

    if (role === 'PROFESSIONAL') {
      url = `${this.api}/appointments/professional`;
    }

    if (role === 'ADMIN') {
      url = `${this.api}/appointments/all`;
    }

    return this.http.get<any[]>(url);
  }

  cancelAppointment(id: string) {
    return this.http.patch(
      `${this.api}/appointments/${id}/cancel`,
      {}
    );
  }

  resolvePenalty(id: string, option: 'CREDIT' | 'REFUND', data?: any) {
    return this.http.patch(
      `${this.api}/appointments/${id}/resolve-penalty`,
      {
        option,
        ...data
      }
    );
  }

  markAsPaid(id: string) {
    return this.http.patch(
      `${this.api}/appointments/${id}/pay`,
      {}
    );
  }

  confirmAppointment(id: string) {
    return this.http.patch(
      `${this.api}/appointments/${id}/confirm`,
      {}
    );
  }

  rescheduleAppointment(id: string, date: string) {
    return this.http.patch(
      `${this.api}/appointments/${id}/reschedule`,
      {
        date
      }
    );
  }
}
