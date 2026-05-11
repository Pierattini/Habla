import { Component, OnInit } from '@angular/core';
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
  conversations: any[] = [];
  loading = false;

  constructor(
  private messagesService: MessagesService,
  private route: ActivatedRoute,
  private router: Router
) {}

  //ngOnInit() {
   // this.loadConversations();
  //}
ionViewWillEnter() {

  const professionalId =
    this.route.snapshot.queryParamMap.get('professionalId');

  this.loadConversations(professionalId);
}
  loadConversations(professionalId?: string | null) {

     if (this.loading) return;
    this.loading = true;
    this.messagesService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        if (professionalId) {

  const existingConversation = data.find(
    (c: any) => c.otherUser?.id === professionalId
  );

  if (existingConversation) {

    this.router.navigate([
      '/tabs/messages',
      existingConversation.conversationId
    ]);

  }

}
        this.loading = false;
        console.log('Conversations:', data);
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }
}