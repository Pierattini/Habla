import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export type ProfessionalSubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

export type AppointmentRequestStatus =
  | 'PENDING'
  | 'LOCKED_PENDING_SUBSCRIPTION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ProfessionalAccess {
  subscriptionStatus: ProfessionalSubscriptionStatus;
  canReceiveUnlimitedRequests: boolean;
  canManageRequests: boolean;
  canReplyMessages: boolean;
  canViewStats: boolean;
  canUsePremiumTools: boolean;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  lastPaymentAt?: string | null;
  activationMessage?: string;
}

export interface ProfessionalAppointmentRequest {
  id: string;
  requestedDate?: string | null;
  requestedMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH' | null;
  status: AppointmentRequestStatus;
  createdAt: string;
  convertedAppointmentId?: string | null;
  locked?: boolean;
  customer?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  };
  message?: string | null;
  activationMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfessionalPlanService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  getAccess() {
    return this.http.get<ProfessionalAccess>(`${this.api}/professionals/me/access`);
  }

  getAppointmentRequests() {
    return this.http.get<ProfessionalAppointmentRequest[]>(
      `${this.api}/appointment-requests/professional`
    );
  }

  acceptRequest(id: string) {
    return this.http.post<ProfessionalAppointmentRequest>(
      `${this.api}/appointment-requests/${id}/accept`,
      {}
    );
  }

  rejectRequest(id: string) {
    return this.http.post<ProfessionalAppointmentRequest>(
      `${this.api}/appointment-requests/${id}/reject`,
      {}
    );
  }

  activateManual() {
    return this.http.post(`${this.api}/professional-subscriptions/activate-manual`, {});
  }

  deactivateManual() {
    return this.http.post(`${this.api}/professional-subscriptions/deactivate-manual`, {});
  }
}
