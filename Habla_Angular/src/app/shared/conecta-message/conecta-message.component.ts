import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ConectaMessageType = 'success' | 'info' | 'warning' | 'error';

@Component({
  selector: 'app-conecta-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="message-backdrop"
      *ngIf="open"
      role="presentation"
      (click)="close()"
    >
      <section
        class="message-card"
        [class]="type"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title"
        (click)="$event.stopPropagation()"
      >
        <div class="message-icon" aria-hidden="true">
          {{ icon }}
        </div>

        <div class="message-copy">
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
        </div>

        <button type="button" (click)="close()">
          Aceptar
        </button>
      </section>
    </div>
  `,
  styleUrls: ['./conecta-message.component.scss'],
})
export class ConectaMessageComponent {
  @Input() open = false;
  @Input() type: ConectaMessageType = 'info';
  @Input() title = '';
  @Input() description = '';
  @Output() dismissed = new EventEmitter<void>();

  get icon(): string {
    const icons: Record<ConectaMessageType, string> = {
      success: '✓',
      info: 'i',
      warning: '!',
      error: 'x',
    };

    return icons[this.type];
  }

  close(): void {
    this.dismissed.emit();
  }
}
