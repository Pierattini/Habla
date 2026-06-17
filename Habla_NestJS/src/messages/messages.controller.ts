import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('support/conversation')
  getOrCreateSupportConversation(@Request() req: { user: { id: string } }) {
    return this.messagesService.getOrCreateSupportConversation(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('send')
  sendMessage(
    @Request() req: any,
    @Body()
    body: {
      receiverId: string;
      content?: string;
      fileUrl?: string;
      fileName?: string;
    },
  ) {
    return this.messagesService.sendMessage(
      req.user.id,
      body.receiverId,
      body.content,
      body.fileUrl,
      body.fileName,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  getConversations(@Request() req: any) {
    return this.messagesService.getConversations(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id')
  getConversationMessages(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.messagesService.getConversationMessages(id, req.user.id);
  }
  @UseGuards(JwtAuthGuard)
  @Patch('conversations/:id/read')
  markConversationAsRead(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.messagesService.markConversationAsRead(id, req.user.id);
  }
  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/files')
  getConversationFiles(
    @Param('id') id: string,
    @Query('type') type: 'documents' | 'images',
    @Request() req: any,
  ) {
    return this.messagesService.getConversationFiles(id, req.user.id, type);
  }
  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req: { user: { id: string } },
  ) {
    return this.messagesService.uploadFileToConversation(id, req.user.id, file);
  }
  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/send')
  sendMessageToConversation(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      content?: string;
      fileUrl?: string;
      fileName?: string;
    },
  ) {
    return this.messagesService.sendMessageToConversation(
      id,
      req.user.id,
      body.content,
      body.fileUrl,
      body.fileName,
    );
  }
}
