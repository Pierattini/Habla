import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export interface MeetingRoom {
  appointmentId: string;
  meetingId: string | null;
  meetingProvider:
    | 'CONNECTA_AUTO'
    | 'GOOGLE_MEET'
    | 'ZOOM'
    | 'MICROSOFT_TEAMS'
    | 'CUSTOM'
    | null;
  meetingUrl: string | null;
  professionalName: string;
  customerName: string;
  date: string;
  status: string;
  isConfirmed: boolean;
  isAvailable: boolean;
  availabilityMessage: string;
  availableFrom: string;
  availableUntil: string;
}

@Injectable({
  providedIn: 'root',
})
export class MeetingService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  getRoom(appointmentId: string, token: string) {
    return this.http.get<MeetingRoom>(
      `${this.api}/meetings/${appointmentId}/${token}`,
      {
        headers: this.getHeaders(),
      },
    );
  }

  private getHeaders() {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
