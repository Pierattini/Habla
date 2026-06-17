import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../core/config/api.config';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface SupportTicket {
  id: string;
  status: SupportTicketStatus;
  conversationId: string;
  customer: {
    id: string;
    email: string;
    name?: string;
  };
  admin: {
    id: string;
    email: string;
    name?: string;
  };
  lastMessage?: {
    content?: string;
    createdAt: string;
  } | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
}

export interface SupportSummary {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
}

@Injectable({
  providedIn: 'root',
})
export class SupportAdminService {
  private api = `${API_URL}/messages/admin/support/tickets`;
  private summaryApi = `${API_URL}/messages/admin/support/summary`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<SupportSummary> {
    return this.http.get<SupportSummary>(this.summaryApi);
  }

  getTickets(status?: SupportTicketStatus | ''): Observable<SupportTicket[]> {
    const query = status ? `?status=${status}` : '';

    return this.http.get<SupportTicket[]>(`${this.api}${query}`);
  }

  getTicketByConversation(conversationId: string): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(
      `${this.api}/conversation/${conversationId}`,
    );
  }

  updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
  ): Observable<SupportTicket> {
    return this.http.patch<SupportTicket>(
      `${this.api}/${ticketId}/status`,
      { status },
    );
  }
}
