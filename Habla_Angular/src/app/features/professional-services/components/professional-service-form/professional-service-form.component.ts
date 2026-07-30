import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreateProfessionalServicePayload,
  ProfessionalService,
  ProfessionalServicePriceType,
  ProfessionalServiceStatus,
} from '../../models/professional-service.models';
import { requiresProfessionalServicePrice } from '../../utils/professional-service-formatters';

interface ServiceFormDraft {
  name: string;
  description: string;
  durationMinutes: number;
  priceType: ProfessionalServicePriceType;
  priceAmount: number | null;
  currency: string;
  status: ProfessionalServiceStatus;
  showInProfile: boolean;
  allowBooking: boolean;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-professional-service-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './professional-service-form.component.html',
  styleUrls: ['./professional-service-form.component.scss'],
})
export class ProfessionalServiceFormComponent implements OnChanges {
  @Input() service: ProfessionalService | null = null;
  @Input() saving = false;
  @Input() defaultCurrency = 'CLP';
  @Output() submitted = new EventEmitter<CreateProfessionalServicePayload>();
  @Output() cancelled = new EventEmitter<void>();

  readonly priceTypes: Array<{
    value: ProfessionalServicePriceType;
    label: string;
  }> = [
    { value: 'FIXED', label: 'Precio fijo' },
    { value: 'FROM', label: 'Precio desde' },
    { value: 'CONSULT', label: 'Consultar precio' },
    { value: 'FREE', label: 'Gratuito' },
  ];
  readonly currencies = ['CLP', 'EUR', 'USD'];
  readonly commonDurations = [15, 30, 45, 60, 90, 120];

  draft: ServiceFormDraft = this.emptyDraft();
  errors: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['service'] || changes['defaultCurrency']) {
      this.draft = this.service
        ? {
            name: this.service.name,
            description: this.service.description || '',
            durationMinutes: this.service.durationMinutes,
            priceType: this.service.priceType,
            priceAmount: this.service.priceAmount,
            currency: this.service.currency,
            status: this.service.status,
            showInProfile: this.service.showInProfile,
            allowBooking: this.service.allowBooking,
            icon: this.service.icon || '',
            color: this.service.color || '',
          }
        : this.emptyDraft();
      this.errors = {};
    }
  }

  onPriceTypeChange(): void {
    if (this.draft.priceType === 'CONSULT') {
      this.draft.priceAmount = null;
    } else if (this.draft.priceType === 'FREE') {
      this.draft.priceAmount = 0;
    }
    delete this.errors['priceAmount'];
  }

  requiresPrice(): boolean {
    return requiresProfessionalServicePrice(this.draft.priceType);
  }

  submit(): void {
    if (this.saving || !this.validate()) {
      return;
    }

    this.submitted.emit({
      name: this.draft.name.trim(),
      description: this.draft.description.trim() || undefined,
      durationMinutes: Number(this.draft.durationMinutes),
      priceType: this.draft.priceType,
      priceAmount: this.requiresPrice()
        ? Number(this.draft.priceAmount)
        : this.draft.priceType === 'FREE'
          ? 0
          : null,
      currency: this.draft.currency,
      status: this.draft.status,
      showInProfile: this.draft.showInProfile,
      allowBooking: this.draft.allowBooking,
      icon: this.draft.icon.trim() || undefined,
      color: this.draft.color || undefined,
    });
  }

  private validate(): boolean {
    const errors: Record<string, string> = {};
    const duration = Number(this.draft.durationMinutes);

    if (this.draft.name.trim().length < 2) {
      errors['name'] = 'Escribe un nombre de al menos 2 caracteres.';
    }

    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      errors['durationMinutes'] = 'La duración debe estar entre 5 y 480 minutos.';
    }

    if (
      this.requiresPrice() &&
      (this.draft.priceAmount === null ||
        !Number.isInteger(Number(this.draft.priceAmount)) ||
        Number(this.draft.priceAmount) < 0)
    ) {
      errors['priceAmount'] = 'Ingresa un precio válido.';
    }

    if (!/^[A-Z]{3}$/.test(this.draft.currency)) {
      errors['currency'] = 'Selecciona una moneda válida.';
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  private emptyDraft(): ServiceFormDraft {
    return {
      name: '',
      description: '',
      durationMinutes: 60,
      priceType: 'FIXED',
      priceAmount: null,
      currency: this.defaultCurrency || 'CLP',
      status: 'ACTIVE',
      showInProfile: true,
      allowBooking: true,
      icon: '',
      color: '',
    };
  }
}
