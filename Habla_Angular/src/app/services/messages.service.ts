import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../core/config/api.config';

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  private apiUrl = `${API_URL}/messages`;

  constructor(private http: HttpClient) {}

  getConversations(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/conversations`
    );
  }

  getConversationMessages(conversationId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/conversations/${conversationId}`
    );
  }

  sendMessageToConversation(
    conversationId: string,
    content: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/conversations/${conversationId}/send`,
      { content }
    );
  }

  markAsRead(conversationId: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/conversations/${conversationId}/read`,
      {}
    );
  }

  getConversationFiles(
    conversationId: string,
    type: 'documents' | 'images'
  ): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/conversations/${conversationId}/files?type=${type}`
    );
  }
  uploadFileToConversation(
  conversationId: string,
  file: File,
): Observable<any> {
  const formData = new FormData();

  formData.append('file', file);

  return this.http.post(
    `${this.apiUrl}/conversations/${conversationId}/upload`,
    formData,
  );
}
}
