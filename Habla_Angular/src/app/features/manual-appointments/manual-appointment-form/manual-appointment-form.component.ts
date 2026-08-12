import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvailableSlotSelectorComponent } from '../available-slot-selector/available-slot-selector.component';
import { CustomerSearchComponent } from '../customer-search/customer-search.component';
import { ManualAppointmentsStore } from '../manual-appointments.store';
import { ProfessionalServicesStore } from '../../professional-services/state/professional-services.store';

@Component({ selector:'app-manual-appointment-form', standalone:true, imports:[CommonModule,FormsModule,CustomerSearchComponent,AvailableSlotSelectorComponent], templateUrl:'./manual-appointment-form.component.html', styleUrl:'./manual-appointment-form.component.scss' })
export class ManualAppointmentFormComponent implements OnInit {
  readonly store = inject(ManualAppointmentsStore);
  readonly servicesStore = inject(ProfessionalServicesStore);
  @Output() created = new EventEmitter<void>();
  @Input() initialDate = '';
  @Input() initialTime = '';
  readonly minDate = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

  ngOnInit(): void {
    this.servicesStore.loadServices(true).subscribe({ error: () => undefined });
    if (this.initialDate) {
      void this.loadInitialSlot();
    }
  }

  get requiresService(): boolean {
    return this.servicesStore.serviceMode() === 'SERVICE_CATALOG';
  }

  get selectedServiceName(): string {
    return this.servicesStore.activeServices().find(
      (service) => service.id === this.store.selectedServiceId(),
    )?.name || '';
  }

  async confirm(): Promise<void> {
    if (await this.store.createAppointment()) this.created.emit();
  }

  async selectService(serviceId: string | null): Promise<void> {
    await this.store.selectService(serviceId);
    this.selectInitialTimeIfAvailable();
  }

  private async loadInitialSlot(): Promise<void> {
    if (this.requiresService && !this.store.selectedServiceId()) {
      this.store.selectedDate.set(this.initialDate);
      return;
    }

    await this.store.loadSlots(this.initialDate);
    this.selectInitialTimeIfAvailable();
  }

  private selectInitialTimeIfAvailable(): void {
    if (this.initialTime && this.store.availableSlots().includes(this.initialTime)) {
      this.store.selectedSlot.set(this.initialTime);
    }
  }
}
