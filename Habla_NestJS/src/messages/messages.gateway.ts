import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const configuredSocketOrigins =
  process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ||
  (process.env.PUBLIC_FRONTEND_URL
    ? [process.env.PUBLIC_FRONTEND_URL]
    : ['http://localhost:4200', 'http://localhost:8100']);

@WebSocketGateway({
  cors: {
    origin: [
      ...new Set([
        ...configuredSocketOrigins,
        'capacitor://localhost',
        'https://localhost',
      ]),
    ],
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('joinConversation')
  handleJoin(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(conversationId);
  }

  // 🔥 emitir mensaje
  sendMessageToRoom(conversationId: string, message: any) {
    this.server.to(conversationId).emit('newMessage', message);
  }
}
