import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonToolbar,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { MessagesService } from '../../services/messages.service';
import { AuthService } from '../../services/auth.service';
import {
  SupportAdminService,
  SupportTicket,
  SupportTicketStatus,
} from '../../services/support-admin.service';
import { addIcons } from 'ionicons';
import { attachOutline, sendOutline } from 'ionicons/icons';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.component.html',
  styleUrls: ['./chat-detail.component.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, IonFooter, IonIcon, IonInput, IonItem, IonLabel, IonToolbar, FormsModule],
})
export class ChatDetailComponent {
  conversationId!: string;
  currentUserId = '';
  currentUserName = '';
  currentUserRole = '';
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
  ) {
    addIcons({
      'attach-outline': attachOutline,
      'send-outline': sendOutline,
    });
  }

  // Mensajes escritos aquí que aún no confirma el servidor ('sending') o que fallaron ('failed').
  pendingMessages: { localId: number; content: string; status: 'sending' | 'failed' | 'sent'; sentAt?: number }[] = [];
  chatError = '';
  uploadingFile = false;
  private isActive = false;
  private loadingMessages = false;
  private nextLocalId = 1;

  ionViewWillEnter() {
    this.clearRefreshInterval();
    this.isActive = true;
    this.chatError = '';
    this.conversationId = this.route.snapshot.paramMap.get('id') || '';

    this.authService.getProfile().subscribe({
      next: (user: any) => {
        this.currentUserId = user.id;
        this.currentUserName = user.name || user.email || 'Usuario';
        this.currentUserRole = user.role || '';
        this.isAdmin = user.role === 'ADMIN';

        this.loadMessages();
        this.loadSupportTicket();

        // Si ya salió de la pantalla mientras cargaba el perfil, no se deja un intervalo vivo.
        if (!this.isActive) return;
        this.clearRefreshInterval();
        this.intervalId = setInterval(() => {
          this.loadMessages();
        }, 5000);

        this.messagesService.markAsRead(this.conversationId).subscribe();
      },
      error: (err: any) => {
        console.error(err);
      },
    });
  }

  ionViewWillLeave() {
    this.isActive = false;
    this.clearRefreshInterval();
  }

  loadMessages() {
    // No se lanza otra consulta si la anterior sigue en camino (señal lenta).
    if (this.loadingMessages || !this.conversationId) return;
    this.loadingMessages = true;
    const requestedAt = Date.now();

    this.messagesService.getConversationMessages(this.conversationId).pipe(
      timeout(20_000),
      finalize(() => (this.loadingMessages = false)),
    ).subscribe({
      next: (data: any[]) => {
        const next = data || [];
        // Solo se redibuja si hay cambios: evita parpadeos de fotos y saltos del scroll.
        if (!this.sameMessages(this.messages, next)) {
          this.messages = next;
        }
        // Los enviados se quitan solo cuando una consulta posterior al envío ya los trae.
        this.pendingMessages = this.pendingMessages.filter(
          (item) => !(item.status === 'sent' && (item.sentAt || 0) <= requestedAt),
        );
        this.chatError = '';
      },
      error: (err: any) => {
        console.error(err);
        if (!this.messages.length) {
          this.chatError = 'No pudimos cargar los mensajes. Revisa tu conexión.';
        }
      },
    });
  }

  private sameMessages(current: any[], next: any[]): boolean {
    if (current.length !== next.length) return false;
    const last = (list: any[]) => list[list.length - 1];
    return !next.length || (last(current)?.id === last(next)?.id && last(current)?.readAt === last(next)?.readAt);
  }

  trackMessage(_index: number, message: any): string {
    return message?.id || String(_index);
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

    const pending = { localId: this.nextLocalId++, content: text, status: 'sending' as const };
    this.pendingMessages.push(pending);
    this.newMessage = '';
    this.deliver(pending);
  }

  // Reintenta un mensaje que no se pudo enviar.
  retryMessage(localId: number) {
    const pending = this.pendingMessages.find((item) => item.localId === localId);
    if (!pending) return;
    pending.status = 'sending';
    this.deliver(pending);
  }

  private deliver(pending: { localId: number; content: string; status: 'sending' | 'failed' | 'sent'; sentAt?: number }) {
    this.messagesService.sendMessageToConversation(this.conversationId, pending.content).pipe(
      timeout(20_000),
    ).subscribe({
      next: () => {
        pending.status = 'sent';
        pending.sentAt = Date.now();
        this.loadMessages();
      },
      error: (err: any) => {
        console.error(err);
        pending.status = 'failed';
      },
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) return;

    const file = input.files[0];
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.chatError = 'El archivo es muy grande. El máximo es 10 MB.';
      input.value = '';
      return;
    }

    this.chatError = '';
    this.uploadingFile = true;
    this.messagesService.uploadFileToConversation(this.conversationId, file).pipe(
      timeout(120_000),
      finalize(() => (this.uploadingFile = false)),
    ).subscribe({
      next: (message) => {
        this.messages = [...this.messages, message];
      },
      error: (err) => {
        console.error(err);
        this.chatError = err?.error?.message || 'No se pudo enviar el archivo. Inténtalo nuevamente.';
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
    // Si el chat se abrió desde una notificación no hay pantalla anterior: se va a Mensajes.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/tabs/messages']);
    }
  }

  isOwnMessage(message: any): boolean {
    return message?.senderId === this.currentUserId || message?.sender?.id === this.currentUserId;
  }

  isCustomerMessage(message: any): boolean {
    const senderRole = message?.sender?.role || message?.senderRole;

    if (senderRole) {
      return senderRole === 'CUSTOMER';
    }

    return message?.senderId === this.currentUserId;
  }

  getSenderLabel(message: any): string {
    const senderRole = message?.sender?.role || message?.senderRole;
    const senderName = message?.sender?.name;

    if (senderRole === 'CUSTOMER') {
      return senderName || 'Paciente';
    }

    if (senderRole === 'PROFESSIONAL') {
      return senderName || this.professionalName || 'Profesional';
    }

    if (message?.senderId === this.currentUserId) {
      return this.currentUserName || 'Usuario';
    }

    return senderName || this.professionalName || 'Profesional';
  }
}
