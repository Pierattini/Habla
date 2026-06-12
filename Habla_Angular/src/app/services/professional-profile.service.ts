import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export type ScheduleMode = 'CONTINUOUS' | 'SPECIFIC';

export interface AvailabilityPayload {
  day: string;
  scheduleMode: ScheduleMode;
  startMinute: number;
  endMinute: number;
  breakMinute: number;
  specificSlots: number[];
  blockedRanges: { startMinute: number; endMinute: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class ProfessionalProfileService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  getProfile() {
    return this.http.get(`${this.api}/users/me`);
  }

  updateProfile(data: {
    name: string;
    image: string;
    specialty?: string;
    description?: string;
    price?: number;
    duration?: number;
  }) {
    return this.http.patch(`${this.api}/users/me`, data);
  }

  getAvailability(professionalId: string) {
    return this.http.get<any[]>(`${this.api}/availability/${professionalId}`);
  }

  saveAvailability(data: AvailabilityPayload) {
    return this.http.post(`${this.api}/availability`, data);
  }

  deleteAvailability(day: string) {
    return this.http.delete(`${this.api}/availability/${day}`);
  }
}
