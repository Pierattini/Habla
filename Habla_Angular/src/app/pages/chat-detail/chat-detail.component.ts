import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessagesService } from '../../services/messages.service';
import { AuthService } from '../../services/auth.service';
import {
  SupportAdminService,
  SupportTicket,
  SupportTicketStatus,
} from '../../services/support-admin.service';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.component.html',
  styleUrls: ['./chat-detail.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class ChatDetailComponent {
  conversationId!: string;
  currentUserId = '';
  professionalName = 'Chat';
  newMessage = '';
  activeTab: 'messages' | 'documents' | 'images' = 'messages';
  messages: any[] = [];
  documents: any[] = [];
  images: any[] = [];
  intervalId: any;
  isAdmin = false;
  supportTicket: SupportTicket | null = null;
  updatingTicketStatus = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messagesService: MessagesService,
    private authService: AuthService,
    private supportAdminService: SupportAdminService,
  ) {}

  ionViewWillEnter() {
    this.clearRefreshInterval();
    this.conversationId = this.route.snapshot.paramMap.get('id') || '';

    this.authService.getProfile().subscribe({
      next: (user: any) => {
        this.currentUserId = user.id;
        this.isAdmin = user.role === 'ADMIN';

        this.loadMessages();
        this.loadSupportTicket();

        this.intervalId = setInterval(() => {
          this.loadMessages();
        }, 3000);

        this.messagesService.markAsRead(this.conversationId).subscribe();
      },
      error: (err: any) => {
        console.error(err);
      },
    });
  }

  ionViewWillLeave() {
    this.clearRefreshInterval();
  }

  loadMessages() {
    this.messagesService.getConversationMessages(this.conversationId).subscribe({
      next: (data: any[]) => {
        this.messages = data;
      },
      error: (err: any) => {
        console.error(err);
      },
    });
  }

  loadSupportTicket() {
    if (!this.isAdmin || !this.conversationId) return;

    this.supportAdminService.getTicketByConversation(this.conversationId).subscribe({
      next: (ticket) => {
        this.supportTicket = ticket;
        this.professionalName =
          ticket.customer?.name || ticket.customer?.email || 'Cliente';
      },
      error: (err) => {
        console.error(err);
        this.supportTicket = null;
      },
    });
  }

  updateSupportTicketStatus(status: SupportTicketStatus) {
    if (!this.supportTicket || this.updatingTicketStatus) return;

    this.updatingTicketStatus = true;

    this.supportAdminService.updateTicketStatus(this.supportTicket.id, status).subscribe({
      next: (ticket) => {
        this.supportTicket = {
          ...this.supportTicket!,
          status: ticket.status,
          closedAt: ticket.closedAt,
        };
        this.updatingTicketStatus = false;
      },
      error: (err) => {
        console.error(err);
        this.updatingTicketStatus = false;
      },
    });
  }

  getSupportStatusLabel(status: SupportTicketStatus): string {
    const labels: Record<SupportTicketStatus, string> = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En progreso',
      CLOSED: 'Cerrado',
    };

    return labels[status];
  }

  loadFiles(type: 'documents' | 'images') {
    this.messagesService.getConversationFiles(this.conversationId, type).subscribe({
      next: (data: any[]) => {
        if (type === 'documents') {
          this.documents = data;
        } else {
          this.images = data;
        }
      },
      error: (err: any) => {
        console.error(err);
      },
    });
  }

  changeTab(tab: 'messages' | 'documents' | 'images') {
    this.activeTab = tab;

    if (tab === 'messages') {
      this.loadMessages();
    }

    if (tab === 'documents') {
      this.loadFiles('documents');
    }

    if (tab === 'images') {
      this.loadFiles('images');
    }
  }

  sendMessage() {
    const text = this.newMessage.trim();
    if (!text) return;

    const tempMessage = {
      content: text,
      senderId: this.currentUserId,
      createdAt: new Date(),
    };

    this.messages.push(tempMessage);
    this.newMessage = '';

    this.messagesService.sendMessageToConversation(this.conversationId, text).subscribe({
      next: () => {
        this.loadMessages();
      },
      error: (err: any) => {
        console.error(err);
      },
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) return;

    const file = input.files[0];

    this.messagesService.uploadFileToConversation(this.conversationId, file).subscribe({
      next: (message) => {
        this.messages.push(message);
      },
      error: (err) => {
        console.error(err);
      },
    });

    input.value = '';
  }

  ngOnDestroy() {
    this.clearRefreshInterval();
  }

  private clearRefreshInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  goBack() {
    window.history.back();
  }
}