import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { MessagesService } from '../../services/messages.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.component.html',
  styleUrls: ['./chat-detail.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class ChatDetailComponent implements OnInit {
  conversationId!: string;

  currentUserId = '';

  professionalName = 'Chat';

  newMessage = '';

  activeTab: 'messages' | 'documents' | 'images' = 'messages';

  messages: any[] = [];
  documents: any[] = [];
  images: any[] = [];

  intervalId: any;

  constructor(
    private route: ActivatedRoute,
    private messagesService: MessagesService,
    private authService: AuthService
  ) {}

  ngOnInit() {
  this.conversationId =
    this.route.snapshot.paramMap.get('id') || '';

  this.authService.getProfile().subscribe({
    next: (user: any) => {
      this.currentUserId = user.id;

      this.loadMessages();

      // 🔥 AUTO REFRESH
       this.intervalId = setInterval(() => {
  this.loadMessages();
}, 3000);

      this.messagesService
        .markAsRead(this.conversationId)
        .subscribe();
    },
    error: (err: any) => {
      console.error(err);
    },
  });
}

  loadMessages() {
    this.messagesService
      .getConversationMessages(this.conversationId)
      .subscribe({
        next: (data: any[]) => {
          this.messages = data;
        },
        error: (err: any) => {
          console.error(err);
        },
      });
  }

  loadFiles(type: 'documents' | 'images') {
    this.messagesService
      .getConversationFiles(this.conversationId, type)
      .subscribe({
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

  // 🔥 MENSAJE INSTANTÁNEO (UX PRO)
  const tempMessage = {
    content: text,
    senderId: this.currentUserId,
    createdAt: new Date()
  };

  this.messages.push(tempMessage);
  this.newMessage = '';

  // 🔥 ENVÍO REAL AL BACKEND
  this.messagesService
    .sendMessageToConversation(this.conversationId, text)
    .subscribe({
      next: () => {
        this.loadMessages(); // sincroniza con backend
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

  this.messagesService
    .uploadFileToConversation(this.conversationId, file)
    .subscribe({
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
  if (this.intervalId) {
    clearInterval(this.intervalId);
  }
}
}