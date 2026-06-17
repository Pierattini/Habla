import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { MessagesService } from '../../services/messages.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
})
export class MessagesComponent {
  public conversations: any[] = [];
  public loading: boolean = false;
  public loaded: boolean = false;
  public requestedProfessionalId: string | null = null;
  public conversationNotFound: boolean = false;

  constructor(
    private messagesService: MessagesService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter() {
    const professionalId =
      this.route.snapshot.queryParamMap.get('professionalId');

    this.requestedProfessionalId = professionalId;
    this.conversationNotFound = false;
    this.loaded = false;

    console.log('Messages professionalId recibido:', professionalId);

    this.loadConversations(professionalId);
  }

  loadConversations(professionalId?: string | null) {
    if (this.loading) return;

    this.loading = true;
    this.conversationNotFound = false;

    this.messagesService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data ?? [];

        console.log('Messages conversaciones cargadas:', this.conversations);

        if (professionalId) {
          const existingConversation = this.conversations.find(
            (c: any) => String(c.otherUser?.id) === String(professionalId)
          );

          console.log('Messages conversacion encontrada:', existingConversation);

          if (existingConversation) {
            this.conversationNotFound = false;
            this.router.navigate(
              ['/tabs/messages', existingConversation.conversationId],
              { replaceUrl: true }
            );
          } else {
            this.conversationNotFound = true;
          }
        } else {
          this.conversationNotFound = false;
        }

        this.loading = false;
        this.loaded = true;
        this.cdr.detectChanges();

        console.log('Conversations:', this.conversations);
      },

      error: (err) => {
        console.error(err);
        this.loading = false;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
  }
}
