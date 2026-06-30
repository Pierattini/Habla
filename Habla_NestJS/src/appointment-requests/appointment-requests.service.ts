import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalAccessService } from './professional-access.service';

type CreateAppointmentRequestBody = {
  professionalId: string;
  requestedDate?: string;
  requestedMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
  message?: string;
};

@Injectable()
export class AppointmentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionalAccess: ProfessionalAccessService,
  ) {}

  async create(customerId: string, body: CreateAppointmentRequestBody) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true },
    });

    if (!customer || customer.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customers can request appointments');
    }

    const professional = await this.prisma.user.findUnique({
      where: { id: body.professionalId },
      select: {
        id: true,
        role: true,
        professional: {
          select: {
            id: true,
            firstLeadReceivedAt: true,
          },
        },
      },
    });

    if (!professional || professional.role !== Role.PROFESSIONAL || !professional.professional) {
      throw new NotFoundException('Professional not found');
    }

    const access = await this.professionalAccess.assertCanReceiveRequests(professional.id);
    const isActive = access.subscriptionStatus === 'ACTIVE';

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        customerId_professionalId: {
          customerId,
          professionalId: professional.id,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          customerId,
          professionalId: professional.id,
        },
      });
    }

    if (!professional.professional.firstLeadReceivedAt) {
      await (this.prisma as any).professional.update({
        where: { id: professional.professional.id },
        data: { firstLeadReceivedAt: new Date() },
      });
    }

    const request = await (this.prisma as any).appointmentRequest.create({
      data: {
        customerId,
        professionalId: professional.id,
        requestedDate: body.requestedDate ? new Date(body.requestedDate) : null,
        requestedMode: body.requestedMode || null,
        message: body.message?.trim() || null,
        status: isActive ? 'PENDING' : 'LOCKED_PENDING_SUBSCRIPTION',
        unlockedAt: isActive ? new Date() : null,
        conversationId: conversation.id,
      },
      include: this.fullInclude(),
    });

    return this.toCustomerView(request);
  }

  async findForProfessional(professionalId: string) {
    const access = await this.professionalAccess.getAccessByUserId(professionalId);
    const requests = await (this.prisma as any).appointmentRequest.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
      include: this.fullInclude(),
    });

    return requests.map((request: any) =>
      this.toProfessionalView(request, access.canManageRequests, access.activationMessage),
    );
  }

  async findOne(id: string, userId: string, role: Role) {
    const request = await (this.prisma as any).appointmentRequest.findUnique({
      where: { id },
      include: this.fullInclude(),
    });

    if (!request) throw new NotFoundException('Appointment request not found');

    if (role === Role.CUSTOMER) {
      if (request.customerId !== userId) {
        throw new ForbiddenException('No access to this request');
      }

      return this.toCustomerView(request);
    }

    if (role === Role.PROFESSIONAL) {
      if (request.professionalId !== userId) {
        throw new ForbiddenException('No access to this request');
      }

      const access = await this.professionalAccess.getAccessByUserId(userId);
      return this.toProfessionalView(
        request,
        access.canManageRequests,
        access.activationMessage,
      );
    }

    return request;
  }

  async accept(id: string, professionalId: string) {
    await this.ensureCanManageRequest(id, professionalId);

    const request = await (this.prisma as any).appointmentRequest.findUnique({
      where: { id },
      include: this.fullInclude(),
    });

    if (!request) throw new NotFoundException('Appointment request not found');

    let convertedAppointmentId = request.convertedAppointmentId;

    if (request.requestedDate && !convertedAppointmentId) {
      const appointment = await this.prisma.appointment.create({
        data: {
          customerId: request.customerId,
          professionalId: request.professionalId,
          date: request.requestedDate,
          status: AppointmentStatus.PENDING,
          attentionMode: request.requestedMode || 'ONLINE',
          conversationId: request.conversationId,
        },
      });

      convertedAppointmentId = appointment.id;
    }

    const updated = await (this.prisma as any).appointmentRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        unlockedAt: request.unlockedAt || new Date(),
        convertedAppointmentId,
      },
      include: this.fullInclude(),
    });

    return this.toProfessionalView(updated, true);
  }

  async reject(id: string, professionalId: string) {
    await this.ensureCanManageRequest(id, professionalId);

    const updated = await (this.prisma as any).appointmentRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: this.fullInclude(),
    });

    return this.toProfessionalView(updated, true);
  }

  private async ensureCanManageRequest(id: string, professionalId: string) {
    const request = await (this.prisma as any).appointmentRequest.findUnique({
      where: { id },
      select: { professionalId: true },
    });

    if (!request) throw new NotFoundException('Appointment request not found');
    if (request.professionalId !== professionalId) {
      throw new ForbiddenException('No access to this request');
    }

    const access = await this.professionalAccess.getAccessByUserId(professionalId);

    if (!access.canManageRequests) {
      throw new ForbiddenException(
        access.activationMessage || 'Activa tu plan profesional para gestionar solicitudes.',
      );
    }
  }

  private fullInclude() {
    return {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      professional: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    };
  }

  private toCustomerView(request: any) {
    return {
      id: request.id,
      professionalId: request.professionalId,
      requestedDate: request.requestedDate,
      requestedMode: request.requestedMode,
      message: request.message,
      status: request.status,
      convertedAppointmentId: request.convertedAppointmentId,
      createdAt: request.createdAt,
    };
  }

  private toProfessionalView(
    request: any,
    unlocked: boolean,
    activationMessage?: string,
  ) {
    const base = {
      id: request.id,
      requestedDate: request.requestedDate,
      requestedMode: request.requestedMode,
      status: request.status,
      createdAt: request.createdAt,
      convertedAppointmentId: request.convertedAppointmentId,
      locked: !unlocked,
    };

    if (!unlocked) {
      return {
        ...base,
        customer: {
          name: 'Paciente interesado',
        },
        message: request.message ? 'Mensaje disponible al activar tu plan.' : null,
        activationMessage:
          activationMessage ||
          'Tienes una nueva solicitud de paciente. Activa tu plan profesional para acceder a los datos de la solicitud y comenzar a recibir pacientes.',
      };
    }

    return {
      ...base,
      customer: request.customer,
      message: request.message,
      conversationId: request.conversationId,
    };
  }
}
