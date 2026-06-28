import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export type ReviewPayload = {
  appointmentId: string;
  rating: number;
  comment?: string;
};

@Injectable({
  providedIn: 'root',
})
export class ReviewsService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  createReview(payload: ReviewPayload) {
    return this.http.post(`${this.api}/reviews`, payload);
  }
}
