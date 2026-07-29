import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProfessionalServiceMode,
  ProfessionalServicePriceType,
  ProfessionalServiceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalServiceDto } from './dto/create-professional-service.dto';
import { ReorderProfessionalServicesDto } from './dto/reorder-professional-services.dto';
import { UpdateProfessionalServiceDto } from './dto/update-professional-service.dto';

@Injectable()
export class ProfessionalServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnServices(userId: string) {
    const professional = await this.getOwnProfessional(userId);
    const services = await this.prisma.professionalService.findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      serviceMode:
        professional.serviceMode ?? ProfessionalServiceMode.SINGLE_PRICE,
      data: services,
    };
  }

  async getOwnService(userId: string, id: string) {
    const professional = await this.getOwnProfessional(userId);
    return this.findOwnedService(professional.id, id);
  }

  async createService(userId: string, dto: CreateProfessionalServiceDto) {
    const professional = await this.getOwnProfessional(userId);
    const priceAmount = this.validateAndNormalizePrice(
      dto.priceType,
      dto.priceAmount,
    );
    const highestOrder = await this.prisma.professionalService.aggregate({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      _max: { sortOrder: true },
    });

    return this.prisma.professionalService.create({
      data: {
        professionalId: professional.id,
        name: dto.name.trim(),
        description: this.cleanOptionalText(dto.description),
        durationMinutes: dto.durationMinutes,
        priceType: dto.priceType,
        priceAmount,
        currency: (
          dto.currency || this.defaultCurrency(professional.country)
        ).toUpperCase(),
        status: dto.status ?? ProfessionalServiceStatus.ACTIVE,
        sortOrder: (highestOrder._max.sortOrder ?? -1) + 1,
        icon: this.cleanOptionalText(dto.icon),
        imageUrl: this.cleanOptionalText(dto.imageUrl),
        color: this.cleanOptionalText(dto.color),
        showInProfile: dto.showInProfile ?? true,
        allowBooking: dto.allowBooking ?? true,
      },
    });
  }

  async updateService(
    userId: string,
    id: string,
    dto: UpdateProfessionalServiceDto,
  ) {
    const professional = await this.getOwnProfessional(userId);
    const existing = await this.findOwnedService(professional.id, id);
    const priceType = dto.priceType ?? existing.priceType;
    const requestedPrice =
      dto.priceAmount !== undefined ? dto.priceAmount : existing.priceAmount;
    const priceAmount = this.validateAndNormalizePrice(
      priceType,
      requestedPrice,
    );

    return this.prisma.professionalService.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: this.cleanOptionalText(dto.description),
        }),
        ...(dto.durationMinutes !== undefined && {
          durationMinutes: dto.durationMinutes,
        }),
        priceType,
        priceAmount,
        ...(dto.currency !== undefined && {
          currency: dto.currency.toUpperCase(),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.icon !== undefined && {
          icon: this.cleanOptionalText(dto.icon),
        }),
        ...(dto.imageUrl !== undefined && {
          imageUrl: this.cleanOptionalText(dto.imageUrl),
        }),
        ...(dto.color !== undefined && {
          color: this.cleanOptionalText(dto.color),
        }),
        ...(dto.showInProfile !== undefined && {
          showInProfile: dto.showInProfile,
        }),
        ...(dto.allowBooking !== undefined && {
          allowBooking: dto.allowBooking,
        }),
      },
    });
  }

  async changeMode(userId: string, serviceMode: ProfessionalServiceMode) {
    const professional = await this.getOwnProfessional(userId);
    const updated = await this.prisma.professional.update({
      where: { id: professional.id },
      data: { serviceMode },
      select: { serviceMode: true },
    });

    return updated;
  }

  async changeStatus(
    userId: string,
    id: string,
    status: ProfessionalServiceStatus,
  ) {
    const professional = await this.getOwnProfessional(userId);
    const service = await this.findOwnedService(professional.id, id);

    return this.prisma.professionalService.update({
      where: { id: service.id },
      data: { status },
    });
  }

  async changeVisibility(userId: string, id: string, showInProfile: boolean) {
    const professional = await this.getOwnProfessional(userId);
    const service = await this.findOwnedService(professional.id, id);

    return this.prisma.professionalService.update({
      where: { id: service.id },
      data: { showInProfile },
    });
  }

  async reorderServices(userId: string, dto: ReorderProfessionalServicesDto) {
    const professional = await this.getOwnProfessional(userId);
    const services = await this.prisma.professionalService.findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    const ownedIds = new Set(services.map((service) => service.id));

    if (
      dto.orderedIds.length !== ownedIds.size ||
      dto.orderedIds.some((id) => !ownedIds.has(id))
    ) {
      throw new BadRequestException(
        'El orden debe incluir todos los servicios disponibles',
      );
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, sortOrder) =>
        this.prisma.professionalService.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );

    return this.prisma.professionalService.findMany({
      where: {
        professionalId: professional.id,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async archiveService(userId: string, id: string) {
    const professional = await this.getOwnProfessional(userId);
    const service = await this.findOwnedService(professional.id, id);

    return this.prisma.professionalService.update({
      where: { id: service.id },
      data: {
        deletedAt: new Date(),
        status: ProfessionalServiceStatus.INACTIVE,
        showInProfile: false,
      },
    });
  }

  async listPublicServices(slug: string) {
    const professional = await this.findProfessionalByPublicSlug(slug);

    if (!professional) {
      throw new NotFoundException('Perfil profesional no encontrado');
    }

    const serviceMode =
      professional.serviceMode ?? ProfessionalServiceMode.SINGLE_PRICE;

    if (serviceMode !== ProfessionalServiceMode.SERVICE_CATALOG) {
      return { serviceMode, data: [] };
    }

    const services = await this.prisma.professionalService.findMany({
      where: {
        professionalId: professional.id,
        status: ProfessionalServiceStatus.ACTIVE,
        showInProfile: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceType: true,
        priceAmount: true,
        currency: true,
        sortOrder: true,
        icon: true,
        imageUrl: true,
        color: true,
        allowBooking: true,
      },
    });

    return { serviceMode, data: services };
  }

  private async getOwnProfessional(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        country: true,
        professional: {
          select: {
            id: true,
            serviceMode: true,
            officeCountry: true,
          },
        },
      },
    });

    if (!user || user.role !== 'PROFESSIONAL' || !user.professional) {
      throw new ForbiddenException(
        'Solo los profesionales pueden administrar servicios',
      );
    }

    return {
      id: user.professional.id,
      serviceMode:
        user.professional.serviceMode ?? ProfessionalServiceMode.SINGLE_PRICE,
      country: user.professional.officeCountry || user.country,
    };
  }

  private async findOwnedService(professionalId: string, id: string) {
    const service = await this.prisma.professionalService.findFirst({
      where: {
        id,
        professionalId,
        deletedAt: null,
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  private async findProfessionalByPublicSlug(slug: string) {
    const exact = await this.prisma.professional.findUnique({
      where: { slug },
      select: { id: true, serviceMode: true },
    });

    if (exact) return exact;

    const legacyMatches = await this.prisma.professional.findMany({
      where: { slug: { startsWith: `${slug}-` } },
      select: { id: true, slug: true, serviceMode: true },
      take: 10,
    });

    return (
      legacyMatches.find((item) => {
        if (!item.slug?.startsWith(`${slug}-`)) return false;
        const suffix = item.slug.slice(slug.length + 1);
        return /^[a-z0-9]{6,}$/.test(suffix);
      }) ?? null
    );
  }

  private validateAndNormalizePrice(
    priceType: ProfessionalServicePriceType,
    priceAmount: number | null | undefined,
  ): number | null {
    if (
      priceType === ProfessionalServicePriceType.FIXED ||
      priceType === ProfessionalServicePriceType.FROM
    ) {
      if (
        priceAmount === null ||
        priceAmount === undefined ||
        !Number.isInteger(priceAmount) ||
        priceAmount < 0
      ) {
        throw new BadRequestException(
          'El precio es obligatorio para este tipo de servicio',
        );
      }

      return priceAmount;
    }

    if (priceType === ProfessionalServicePriceType.CONSULT) {
      if (priceAmount !== null && priceAmount !== undefined) {
        throw new BadRequestException(
          'Los servicios a consultar no deben incluir un precio',
        );
      }

      return null;
    }

    if (
      priceAmount !== null &&
      priceAmount !== undefined &&
      priceAmount !== 0
    ) {
      throw new BadRequestException(
        'Los servicios gratuitos deben tener precio cero',
      );
    }

    return 0;
  }

  private defaultCurrency(country?: string | null): string {
    return String(country || '').toUpperCase() === 'ES' ? 'EUR' : 'CLP';
  }

  private cleanOptionalText(value?: string | null): string | null {
    const cleaned = String(value ?? '').trim();
    return cleaned || null;
  }
}
