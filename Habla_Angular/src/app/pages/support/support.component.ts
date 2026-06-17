import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MessagesService } from '../../services/messages.service';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss'],
})
export class SupportComponent {
  loading = false;
  errorMessage = '';

  constructor(
    private messagesService: MessagesService,
    private router: Router
  ) {}

  openSupportChat(): void {
    if (this.loading) return;

    this.loading = true;
    this.errorMessage = '';

    this.messagesService.getOrCreateSupportConversation().subscribe({
      next: (conversation: any) => {
        this.router.navigate(['/tabs/messages', conversation.conversationId]);
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message ||
          'Soporte no esta disponible en este momento. Intenta nuevamente mas tarde.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/tabs/profile']);
  }
}
