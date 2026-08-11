import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { ProfessionalTimeBlock } from '../professional-time-blocks.models';
import { ProfessionalTimeBlocksStore } from '../professional-time-blocks.store';
import { TimeBlockCardComponent } from '../time-block-card/time-block-card.component';

@Component({
  selector: 'app-time-block-list',
  standalone: true,
  imports: [CommonModule, TimeBlockCardComponent],
  templateUrl: './time-block-list.component.html',
  styleUrl: './time-block-list.component.scss',
})
export class TimeBlockListComponent {
  @Input({ required: true }) blocks: ProfessionalTimeBlock[] = [];
  readonly store = inject(ProfessionalTimeBlocksStore);
  private readonly alerts = inject(AlertController);

  async confirmDelete(block: ProfessionalTimeBlock): Promise<void> {
    const alert = await this.alerts.create({
      header: '¿Quieres desbloquear este horario?',
      message: 'Al hacerlo, volverá a estar disponible según tu configuración habitual.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Desbloquear', role: 'destructive', handler: () => void this.store.deleteBlock(block.id) },
      ],
    });
    await alert.present();
  }
}

