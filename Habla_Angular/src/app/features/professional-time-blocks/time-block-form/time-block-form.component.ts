import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateProfessionalTimeBlock, ProfessionalTimeBlockType } from '../professional-time-blocks.models';

@Component({
  selector: 'app-time-block-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './time-block-form.component.html',
  styleUrl: './time-block-form.component.scss',
})
export class TimeBlockFormComponent {
  @Input() saving = false;
  @Output() createBlock = new EventEmitter<CreateProfessionalTimeBlock>();

  type: ProfessionalTimeBlockType = 'TIME_RANGE';
  date = '';
  startTime = '09:00';
  endTime = '10:00';
  startDate = '';
  endDate = '';
  reason = '';
  validationError = '';
  readonly minDate = this.localDateKey(new Date());

  submit(): void {
    if (this.saving) return;
    const payload = this.buildPayload();
    if (payload) this.createBlock.emit(payload);
  }

  reset(): void {
    this.date = '';
    this.startDate = '';
    this.endDate = '';
    this.reason = '';
    this.validationError = '';
  }

  private buildPayload(): CreateProfessionalTimeBlock | null {
    this.validationError = '';
    let start: Date;
    let end: Date;

    if (this.type === 'TIME_RANGE') {
      if (!this.date || !this.startTime || !this.endTime) {
        return this.invalid('Selecciona la fecha y ambas horas.');
      }
      start = new Date(`${this.date}T${this.startTime}:00`);
      end = new Date(`${this.date}T${this.endTime}:00`);
      if (end <= start) return this.invalid('La hora de término debe ser posterior a la hora de inicio.');
    } else if (this.type === 'FULL_DAY') {
      if (!this.date) return this.invalid('Selecciona la fecha que quieres bloquear.');
      start = new Date(`${this.date}T00:00:00`);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    } else {
      if (!this.startDate || !this.endDate) {
        return this.invalid('Selecciona la fecha de inicio y la fecha de término.');
      }
      start = new Date(`${this.startDate}T00:00:00`);
      end = new Date(`${this.endDate}T00:00:00`);
      if (end < start) return this.invalid('La fecha de término no puede ser anterior al inicio.');
      end.setDate(end.getDate() + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) return this.invalid('No puedes crear bloqueos en fechas pasadas.');

    return {
      type: this.type,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      ...(this.reason.trim() ? { reason: this.reason.trim() } : {}),
    };
  }

  private invalid(message: string): null {
    this.validationError = message;
    return null;
  }

  private localDateKey(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
}

