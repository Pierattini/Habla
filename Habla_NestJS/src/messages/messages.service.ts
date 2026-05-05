import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, Role } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { v2 as cloudinary } from 'cloudinary';
import { MessagesGateway } from './messages.gateway';
@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private gateway: MessagesGateway,
  ) {}

  async sendMessage(
    senderId: string,
    receiverId: string,
    content?: string,
    fileUrl?: string,
    fileName?: string,
  ) {
    if (senderId === receiverId) {
      throw new ForbiddenException('Cannot message yourself');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
    });

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!sender || !receiver) {
      throw new NotFoundException('User not found');
    }

    let customerId: string;
    let professionalId: string;

    if (sender.role === Role.CUSTOMER && receiver.role === Role.PROFESSIONAL) {
      customerId = senderId;
      professionalId = receiverId;
    } else if (
      sender.role === Role.PROFESSIONAL &&
      receiver.role === Role.CUSTOMER
    ) {
      customerId = receiverId;
      professionalId = senderId;
    } else {
      throw new ForbiddenException(
        'Only customer-professional conversations allowed',
      );
    }

    const appointmentExists = await this.prisma.appointment.findFirst({
      where: {
        customerId,
        professionalId,
        status: {
          not: AppointmentStatus.CANCELLED,
        },
      },
    });

    if (!appointmentExists) {
      throw new ForbiddenException('No appointment exists between these users');
    }

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        customerId_professionalId: {
          customerId,
          professionalId,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          customerId,
          professionalId,
        },
      });
    }
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
      },
    });
    return this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content,
        fileUrl,
        fileName,
      },
    });
  }
  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ customerId: userId }, { professionalId: userId }],
      },

      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },

        professional: {
          select: {
            id: true,
            email: true,
            name: true,
            professional: {
              select: {
                specialty: true,
                image: true,
              },
            },
          },
        },

        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },

        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderId: {
                  not: userId,
                },
              },
            },
          },
        },
      },

      orderBy: {
        updatedAt: 'desc',
      },
    });

    return conversations.map((conv) => {
      const otherUser =
        conv.customerId === userId ? conv.professional : conv.customer;

      return {
        conversationId: conv.id,
        otherUser,
        lastMessage: conv.messages[0] ?? null,
        updatedAt: conv.updatedAt,
        unreadCount: conv._count.messages,
      };
    });
  }
  async getConversationMessages(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.customerId !== userId &&
      conversation.professionalId !== userId
    ) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    return this.prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
  async markConversationAsRead(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.customerId !== userId &&
      conversation.professionalId !== userId
    ) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    return this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: {
          not: userId,
        },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }
  async sendMessageToConversation(
    conversationId: string,
    senderId: string,
    content?: string,
    fileUrl?: string,
    fileName?: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.customerId !== senderId &&
      conversation.professionalId !== senderId
    ) {
      throw new ForbiddenException('You do not belong to this conversation');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        fileUrl,
        fileName,
      },
    });
  }
  async getConversationFiles(
    conversationId: string,
    userId: string,
    type: 'documents' | 'images',
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.customerId !== userId &&
      conversation.professionalId !== userId
    ) {
      throw new ForbiddenException('No access to this conversation');
    }

    const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];

    const files = await this.prisma.message.findMany({
      where: {
        conversationId,
        fileUrl: { not: null },

        ...(type === 'images'
          ? {
              fileType: {
                in: imageTypes,
              },
            }
          : {
              NOT: {
                fileType: {
                  in: imageTypes,
                },
              },
            }),
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return files.map((file) => ({
      ...file,
      fileUrl:
        type === 'documents' && file.filePublicId
          ? cloudinary.url(file.filePublicId, {
              resource_type: 'raw',
              flags: 'attachment',
            })
          : file.fileUrl,
    }));
  }
  async uploadFileToConversation(
    conversationId: string,
    senderId: string,
    file: any,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.customerId !== senderId &&
      conversation.professionalId !== senderId
    ) {
      throw new ForbiddenException('You do not belong to this conversation');
    }

    const uploaded: any = await this.cloudinaryService.uploadFile(file);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        fileUrl: uploaded.secure_url,
        filePublicId: uploaded.public_id,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
      },
    });
  }
}
