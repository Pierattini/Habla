import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/config/api.config';
import {
  CreateProfessionalTimeBlock,
  ProfessionalTimeBlock,
} from './professional-time-blocks.models';

@Injectable({ providedIn: 'root' })
export class ProfessionalTimeBlocksStore {
  private readonly http = inject(HttpClient);
  private readonly blocksState = signal<ProfessionalTimeBlock[]>([]);

  readonly blocks = this.blocksState.asReadonly();
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly selectedRange = signal<CreateProfessionalTimeBlock | null>(null);
  readonly initialized = signal(false);
  readonly upcomingBlocks = computed(() => {
    const now = Date.now();
    return this.blocksState()
      .filter((block) => new Date(block.endAt).getTime() > now)
      .sort((left, right) =>
        new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
      );
  });

  async loadBlocks(force = false): Promise<void> {
    if (this.loading() || (this.initialized() && !force)) return;
    this.loading.set(true);
    this.clearError();
    try {
      const blocks = await firstValueFrom(
        this.http.get<ProfessionalTimeBlock[]>(`${API_URL}/professional-time-blocks`),
      );
      this.blocksState.set([...blocks].sort(this.byStartDate));
      this.initialized.set(true);
    } catch (error) {
      this.error.set(this.toFriendlyError(error, 'load'));
    } finally {
      this.loading.set(false);
    }
  }

  async createBlock(payload: CreateProfessionalTimeBlock): Promise<boolean> {
    if (this.saving()) return false;
    this.saving.set(true);
    this.selectedRange.set(payload);
    this.clearError();
    try {
      const created = await firstValueFrom(
        this.http.post<ProfessionalTimeBlock>(
          `${API_URL}/professional-time-blocks`,
          payload,
        ),
      );
      this.blocksState.update((blocks) => [...blocks, created].sort(this.byStartDate));
      return true;
    } catch (error) {
      this.error.set(this.toFriendlyError(error, 'save'));
      return false;
    } finally {
      this.saving.set(false);
      this.selectedRange.set(null);
    }
  }

  async deleteBlock(id: string): Promise<boolean> {
    if (this.deleting()) return false;
    this.deleting.set(id);
    this.clearError();
    try {
      await firstValueFrom(
        this.http.delete(`${API_URL}/professional-time-blocks/${id}`),
      );
      this.blocksState.update((blocks) => blocks.filter((block) => block.id !== id));
      return true;
    } catch (error) {
      this.error.set(this.toFriendlyError(error, 'delete'));
      return false;
    } finally {
      this.deleting.set(null);
    }
  }

  clearError(): void {
    this.error.set(null);
  }

  private readonly byStartDate = (
    left: ProfessionalTimeBlock,
    right: ProfessionalTimeBlock,
  ) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime();

  private toFriendlyError(error: unknown, operation: 'load' | 'save' | 'delete'): string {
    const response = error instanceof HttpErrorResponse ? error.error : null;
    const raw = Array.isArray(response?.message)
      ? response.message.join(' ')
      : String(response?.message || '');
    const message = raw.toLowerCase();

    if (message.includes('cita') || message.includes('solapa')) {
      return 'Ese horario ya tiene una cita y no puede bloquearse.';
    }
    if (message.includes('bloquead') || message.includes('bloqueo')) {
      return 'Ese horario ya está bloqueado.';
    }
    if (operation === 'load') return 'No pudimos cargar tus bloqueos. Inténtalo nuevamente.';
    if (operation === 'delete') return 'No pudimos desbloquear este horario. Inténtalo nuevamente.';
    return 'No pudimos guardar el bloqueo. Inténtalo nuevamente.';
  }
}
