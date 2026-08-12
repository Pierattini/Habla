import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { AlertController } from '@ionic/angular';
import {
  CreateProfessionalServicePayload,
  ProfessionalService,
  ProfessionalServiceMode,
  UpdateProfessionalServicePayload,
} from '../../models/professional-service.models';
import { ProfessionalServicesStore } from '../../state/professional-services.store';
import { ProfessionalServiceCardComponent } from '../professional-service-card/professional-service-card.component';
import { ProfessionalServiceFormComponent } from '../professional-service-form/professional-service-form.component';
import { ServiceModeSelectorComponent } from '../service-mode-selector/service-mode-selector.component';

@Component({
  selector: 'app-professional-services-manager',
  standalone: true,
  imports: [
    CommonModule,
    ProfessionalServiceCardComponent,
    ProfessionalServiceFormComponent,
    ServiceModeSelectorComponent,
  ],
  templateUrl: './professional-services-manager.component.html',
  styleUrls: ['./professional-services-manager.component.scss'],
})
export class ProfessionalServicesManagerComponent implements OnInit {
  @Input() country = 'CL';

  readonly formOpen = signal(false);
  readonly editingService = signal<ProfessionalService | null>(null);
  readonly feedbackMessage = signal('');

  constructor(
    readonly store: ProfessionalServicesStore,
    private readonly alertController: AlertController,
  ) {}

  ngOnInit(): void {
    this.store.loadServices().subscribe({
      error: () => undefined,
    });
  }

  get defaultCurrency(): string {
    return this.country === 'ES' ? 'EUR' : 'CLP';
  }

  retry(): void {
    this.store.loadServices(true).subscribe({
      error: () => undefined,
    });
  }

  async requestMode(mode: ProfessionalServiceMode): Promise<void> {
    this.applyMode(mode);
  }

  openCreateForm(): void {
    if (!this.store.canCreateService()) {
      this.feedbackMessage.set('Puedes registrar un máximo de 10 servicios.');
      return;
    }

    this.store.clearError();
    this.editingService.set(null);
    this.formOpen.set(true);
    this.feedbackMessage.set('');
  }

  openEditForm(service: ProfessionalService): void {
    this.store.clearError();
    this.editingService.set(service);
    this.store.selectService(service);
    this.formOpen.set(true);
    this.feedbackMessage.set('');
  }

  async requestCloseForm(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar formulario',
      message: 'Los cambios que no hayas guardado se perderán.',
      buttons: [
        { text: 'Seguir editando', role: 'cancel' },
        {
          text: 'Descartar cambios',
          role: 'destructive',
          handler: () => this.closeForm(),
        },
      ],
      cssClass: 'conecta-alert',
    });

    await alert.present();
  }

  save(payload: CreateProfessionalServicePayload): void {
    const editing = this.editingService();
    const request = editing
      ? this.store.updateService(editing.id, this.toUpdatePayload(payload))
      : this.store.createService(payload);

    request.subscribe({
      next: () => {
        this.feedbackMessage.set(
          editing ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.',
        );
        this.closeForm(false);
      },
      error: () => undefined,
    });
  }

  toggleStatus(service: ProfessionalService): void {
    this.store.toggleStatus(service).subscribe({
      next: () =>
        this.feedbackMessage.set(
          service.status === 'ACTIVE' ? 'Servicio desactivado.' : 'Servicio activado.',
        ),
      error: () => undefined,
    });
  }

  toggleVisibility(service: ProfessionalService): void {
    this.store.toggleVisibility(service).subscribe({
      next: () =>
        this.feedbackMessage.set(
          service.showInProfile
            ? 'El servicio ya no se mostrará públicamente.'
            : 'El servicio se mostrará públicamente.',
        ),
      error: () => undefined,
    });
  }

  move(service: ProfessionalService, direction: -1 | 1): void {
    const services = this.store.orderedServices();
    const currentIndex = services.findIndex((item) => item.id === service.id);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= services.length) {
      return;
    }

    const orderedIds = services.map((item) => item.id);
    [orderedIds[currentIndex], orderedIds[targetIndex]] = [
      orderedIds[targetIndex],
      orderedIds[currentIndex],
    ];

    this.store.reorderServices(orderedIds).subscribe({
      error: () => undefined,
    });
  }

  async requestArchive(service: ProfessionalService): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Archivar servicio',
      message: `“${service.name}” dejará de aparecer en tu catálogo. Esta acción no afecta citas ni disponibilidad.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Archivar',
          role: 'destructive',
          handler: () => this.archive(service),
        },
      ],
      cssClass: 'conecta-alert',
    });

    await alert.present();
  }

  private applyMode(mode: ProfessionalServiceMode): void {
    this.store.changeServiceMode(mode).subscribe({
      next: () => {
        this.feedbackMessage.set(
          mode === 'SERVICE_CATALOG'
            ? 'Catálogo de servicios activado.'
            : 'Modalidad de precio único activada.',
        );
        if (mode === 'SINGLE_PRICE') {
          this.closeForm(false);
        }
      },
      error: () => undefined,
    });
  }

  private archive(service: ProfessionalService): void {
    this.store.archiveService(service.id).subscribe({
      next: () => this.feedbackMessage.set('Servicio archivado.'),
      error: () => undefined,
    });
  }

  private closeForm(clearFeedback = true): void {
    this.formOpen.set(false);
    this.editingService.set(null);
    this.store.selectService(null);
    if (clearFeedback) {
      this.feedbackMessage.set('');
    }
  }

  private toUpdatePayload(
    payload: CreateProfessionalServicePayload,
  ): UpdateProfessionalServicePayload {
    return {
      ...payload,
      description: payload.description ?? null,
      icon: payload.icon ?? null,
      color: payload.color ?? null,
    };
  }
}
