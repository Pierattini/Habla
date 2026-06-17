import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, Role, SupportTicketStatus } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { v2 as cloudinary } from 'cloudinary';
import { MessagesGateway } from './messages.gateway';
import { EmailService } from '../email/email.service';
@Injectable()
export class MessagesService {
  private readonly supportMessageEmailCooldownMs = 5 * 60 * 1000;
  private readonly supportMessageEmailSentAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private gateway: MessagesGateway,
    private emailService: EmailService,
  ) {}

  async getSupportSummary() {
    const [total, open, inProgress, closed] = await Promise.all([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({
        where: { status: SupportTicketStatus.OPEN },
      }),
      this.prisma.supportTicket.count({
        where: { status: SupportTicketStatus.IN_PROGRESS },
      }),
      this.prisma.supportTicket.count({
        where: { status: SupportTicketStatus.CLOSED },
      }),
    ]);

    return {
      total,
      open,
      inProgress,
      closed,
    };
  }

  async getSupportTickets(status?: SupportTicketStatus) {
    if (status && !Object.values(SupportTicketStatus).includes(status)) {
      throw new BadRequestException('Invalid support ticket status');
    }

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        ...(status && { status }),
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        conversation: {
          include: {
            messages: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
            _count: {
              select: {
                messages: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      status: ticket.status,
      conversationId: ticket.conversationId,
      customer: ticket.customer,
      admin: ticket.admin,
      lastMessage: ticket.conversation.messages[0] ?? null,
      messageCount: ticket.conversation._count.messages,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      closedAt: ticket.closedAt,
    }));
  }

  async updateSupportTicketStatus(
    id: string,
    status: SupportTicketStatus,
  ) {
    if (!Object.values(SupportTicketStatus).includes(status)) {
      throw new BadRequestException('Invalid support ticket status');
    }

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        closedAt:
          status === SupportTicketStatus.CLOSED
            ? ticket.closedAt ?? new Date()
            : null,
      },
    });
  }

  async getSupportTicketByConversation(conversationId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        conversationId,
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        conversation: {
          include: {
            messages: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
            _count: {
              select: {
                messages: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return {
      id: ticket.id,
      status: ticket.status,
      conversationId: ticket.conversationId,
      customer: ticket.customer,
      admin: ticket.admin,
      lastMessage: ticket.conversation.messages[0] ?? null,
      messageCount: ticket.conversation._count.messages,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      closedAt: ticket.closedAt,
    };
  }

  async getOrCreateSupportConversation(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      throw new ForbiddenException('Admin users cannot open support as clients');
    }

    const admin = await this.prisma.user.findFirst({
      where: {
        role: Role.ADMIN,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!admin) {
      throw new NotFoundException('Support is not available');
    }

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        customerId_professionalId: {
          customerId: userId,
          professionalId: admin.id,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          customerId: userId,
          professionalId: admin.id,
          messages: {
            create: {
              senderId: admin.id,
              content:
                'Hola, somos soporte de Habla. Cuéntanos en qué podemos ayudarte.',
            },
          },
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });
    }

    let ticket = await this.prisma.supportTicket.findFirst({
      where: {
        conversationId: conversation.id,
        status: {
          in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!ticket) {
      ticket = await this.prisma.supportTicket.create({
        data: {
          conversationId: conversation.id,
          customerId: userId,
          adminId: admin.id,
          status: SupportTicketStatus.OPEN,
        },
      });

      this.notifySupportTicketCreated(ticket.id, conversation.id, user, admin);
    }

    return {
      conversationId: conversation.id,
      ticketId: ticket.id,
      ticketStatus: ticket.status,
      otherUser: {
        id: admin.id,
        email: admin.email,
        name: admin.name || 'Soporte Habla',
      },
      lastMessage: conversation.messages[0] ?? null,
      updatedAt: conversation.updatedAt,
      unreadCount: 0,
      isSupport: true,
    };
  }

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

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        fileUrl,
        fileName,
      },
    });

    this.notifySupportTicketMessage(conversationId, senderId, content);

    return message;
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

  private notifySupportTicketCreated(
    ticketId: string,
    conversationId: string,
    customer: { email: string; name?: string | null },
    admin: { email: string; name?: string | null },
  ) {
    this.emailService
      .sendSupportTicketCreatedEmail({
        adminEmail: admin.email,
        adminName: admin.name || 'Soporte Habla',
        customerName: customer.name || customer.email,
        customerEmail: customer.email,
        ticketId,
        conversationId,
      })
      .catch((error) =>
        console.error('Error enviando correo de nuevo ticket:', error),
      );
  }

  private async notifySupportTicketMessage(
    conversationId: string,
    senderId: string,
    content?: string,
  ) {
    try {
      const ticket = await this.prisma.supportTicket.findFirst({
        where: {
          conversationId,
          status: {
            in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          admin: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!ticket || ticket.customerId !== senderId) return;
      if (!this.canSendSupportMessageEmail(conversationId)) return;

      await this.emailService.sendSupportTicketMessageEmail({
        adminEmail: ticket.admin.email,
        adminName: ticket.admin.name || 'Soporte Habla',
        customerName: ticket.customer.name || ticket.customer.email,
        customerEmail: ticket.customer.email,
        ticketId: ticket.id,
        conversationId: ticket.conversationId,
        message: content,
      });
    } catch (error) {
      console.error('Error enviando correo de mensaje soporte:', error);
    }
  }

  private canSendSupportMessageEmail(conversationId: string) {
    const now = Date.now();
    const lastSentAt = this.supportMessageEmailSentAt.get(conversationId) ?? 0;

    if (now - lastSentAt < this.supportMessageEmailCooldownMs) {
      return false;
    }

    this.supportMessageEmailSentAt.set(conversationId, now);
    return true;
  }
}
