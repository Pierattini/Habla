import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export type PublicProfileEventType = 'VIEW' | 'COPY_LINK' | 'SHARE';

export interface PublicProfessional {
  id: string;
  slug: string;
  name: string;
  firstName?: string;
  lastInitial?: string;
  specialty: string;
  professionName?: string | null;
  categoryName?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  ratingAverage: number;
  reviewsCount: number;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    customer?: {
      name?: string | null;
      image?: string | null;
    };
  }>;
  shortDescription?: string;
  description?: string;
  experience?: string;
  specialties?: string[];
  price?: number | null;
  duration?: number | null;
  image?: string | null;
  attentionMode: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
  officeCity?: string | null;
  officeRegion?: string | null;
  officeCountry?: string | null;
  videoProvider?:
    | 'CONNECTA_AUTO'
    | 'JITSI'
    | 'GOOGLE_MEET'
    | 'ZOOM'
    | 'MICROSOFT_TEAMS'
    | 'CUSTOM';
  documentAutomationEnabled?: boolean;
  manualDocumentMode?: boolean;
  taxDocumentReady?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PublicProfessionalService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  getBySlug(slug: string) {
    return this.http.get<PublicProfessional>(
      `${this.api}/professionals/public/${slug}`,
    );
  }

  recordEvent(slug: string, type: PublicProfileEventType) {
    return this.http.post(`${this.api}/professionals/public/${slug}/events`, {
      type,
    });
  }
}
