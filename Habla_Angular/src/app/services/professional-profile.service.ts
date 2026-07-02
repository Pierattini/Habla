import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export type ScheduleMode = 'CONTINUOUS' | 'SPECIFIC';
export type AttentionMode = 'ONLINE' | 'PRESENTIAL' | 'BOTH';
export type VideoProvider =
  | 'CONNECTA_AUTO'
  | 'JITSI'
  | 'GOOGLE_MEET'
  | 'ZOOM'
  | 'MICROSOFT_TEAMS'
  | 'CUSTOM';

export interface ProfessionalProfile {
  slug?: string;
  name: string;
  specialty: string;
  description: string;
  price: number;
  duration: number;
  interval: number;
  rules: string;
  image: string;
  attentionMode: AttentionMode;
  officeAddress: string;
  officeCity: string;
  officeRegion: string;
  officeCountry: string;
  officeLatitude: number | null;
  officeLongitude: number | null;
  arrivalInstructions: string;
  videoProvider: VideoProvider;
  customVideoUrl: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  accountEmail: string;
  documentAutomationEnabled: boolean;
  manualDocumentMode: boolean;
  taxId: string;
  taxName: string;
  taxEmail: string;
  taxAddress: string;
  taxCountry: string;
  taxCity: string;
}

export interface ProfessionalProfileResponse {
  id: string;
  professional?: Partial<ProfessionalProfile>;
}

export type ProfessionalProfileUpdatePayload = Omit<ProfessionalProfile, 'interval'>;

export interface AvailabilityResponse {
  day: string;
  scheduleMode?: ScheduleMode;
  startMinute?: number;
  endMinute?: number;
  breakMinute?: number;
  specificSlots?: number[];
  blockedRanges?: { startMinute: number; endMinute: number }[];
}

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
    return this.http.get<ProfessionalProfileResponse>(`${this.api}/users/me`);
  }

  updateProfile(data: ProfessionalProfileUpdatePayload) {
    return this.http.patch<ProfessionalProfileResponse>(`${this.api}/users/me`, data);
  }

  getAvailability(professionalId: string) {
    return this.http.get<AvailabilityResponse[]>(`${this.api}/availability/${professionalId}`);
  }

  saveAvailability(data: AvailabilityPayload) {
    return this.http.post(`${this.api}/availability`, data);
  }

  deleteAvailability(day: string) {
    return this.http.delete(`${this.api}/availability/${day}`);
  }
}
