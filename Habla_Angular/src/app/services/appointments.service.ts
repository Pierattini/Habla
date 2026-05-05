import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AppointmentsService {

  private api = 'http://localhost:3000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  createAppointment(body: any) {
    return this.http.post(
      `${this.api}/appointments`,
      body,
      {
        headers: this.authService.getHeaders()
      }
    );
  }

  getMyAppointments() {
    return this.http.get(
      `${this.api}/appointments/mine`,
      {
        headers: this.authService.getHeaders()
      }
    );
  }
}