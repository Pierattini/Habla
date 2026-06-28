import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, dto: CreateReviewDto) {
    const rating = Number(dto.rating);
    const comment = this.normalizeComment(dto.comment);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('La puntuacion debe estar entre 1 y 5.');
    }

    if (comment && comment.length > 500) {
      throw new BadRequestException('El comentario no puede superar 500 caracteres.');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        customer: true,
        professional: true,
        review: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada.');
    }

    if (appointment.customerId !== customerId) {
      throw new ForbiddenException('Solo el paciente de la cita puede valorar.');
    }

    if (appointment.customer.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Solo pacientes pueden dejar valoraciones.');
    }

    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Solo puedes valorar citas finalizadas.');
    }

    if (appointment.review) {
      throw new BadRequestException('Esta cita ya fue valorada.');
    }

    return this.prisma.review.create({
      data: {
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        professionalId: appointment.professionalId,
        rating,
        comment,
      },
      select: this.getPublicReviewSelect(),
    });
  }

  async findByProfessional(professionalId: string) {
    return this.prisma.review.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
      select: this.getPublicReviewSelect(),
    });
  }

  async getProfessionalSummary(professionalId: string) {
    const result = await this.prisma.review.aggregate({
      where: { professionalId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      ratingAverage: Number((result._avg.rating || 0).toFixed(1)),
      reviewsCount: result._count.rating,
    };
  }

  private normalizeComment(comment?: string) {
    const value = String(comment || '').trim().replace(/\s+/g, ' ');
    return value || null;
  }

  private getPublicReviewSelect() {
    return {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
          image: true,
        },
      },
    };
  }
}
