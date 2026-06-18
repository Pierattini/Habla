import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export type ProfessionItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  aliases?: string[];
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type ProfessionCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  professions: ProfessionItem[];
};

@Injectable({
  providedIn: 'root',
})
export class ProfessionService {
  constructor(private http: HttpClient) {}

  getCategories() {
    return this.http.get<ProfessionCategory[]>(`${API_URL}/professions/categories`);
  }

  getProfessions(params?: { categorySlug?: string; search?: string }) {
    const query = new URLSearchParams();

    if (params?.categorySlug) query.set('categorySlug', params.categorySlug);
    if (params?.search) query.set('search', params.search);

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.http.get<ProfessionItem[]>(`${API_URL}/professions${suffix}`);
  }
}
