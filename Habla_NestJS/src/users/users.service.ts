import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { AttentionModality, Prisma, Role } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import ct from 'countries-and-timezones';

type FindProfessionalsParams = {
  page: number;
  limit: number;
  search?: string;
  specialty?: string;
  professionId?: string;
  professionSlug?: string;
  categorySlug?: string;
  attentionMode?: string;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserDto) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: data.role ?? Role.CUSTOMER,
        },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const dataToUpdate: any = {};

    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.email !== undefined) dataToUpdate.email = dto.email;
    if (dto.image !== undefined) dataToUpdate.image = dto.image;
    if (dto.timezone !== undefined) dataToUpdate.timezone = dto.timezone;
    if (dto.taxId !== undefined) dataToUpdate.taxId = dto.taxId;
    if (dto.taxName !== undefined) dataToUpdate.taxName = dto.taxName;
    if (dto.taxEmail !== undefined) dataToUpdate.taxEmail = dto.taxEmail;
    if (dto.taxAddress !== undefined) dataToUpdate.taxAddress = dto.taxAddress;
    if (dto.taxCountry !== undefined) dataToUpdate.taxCountry = dto.taxCountry;
    if (dto.taxCity !== undefined) dataToUpdate.taxCity = dto.taxCity;
    if (dto.customerInterests !== undefined) {
      dataToUpdate.customerInterests = dto.customerInterests;
    }
    if (dto.preferredAttentionMode !== undefined) {
      dataToUpdate.preferredAttentionMode = dto.preferredAttentionMode;
    }
    if (dto.preferredCity !== undefined) {
      dataToUpdate.preferredCity = dto.preferredCity;
    }
    if (dto.preferredRegion !== undefined) {
      dataToUpdate.preferredRegion = dto.preferredRegion;
    }
    if (dto.wantsTaxDocumentByDefault !== undefined) {
      dataToUpdate.wantsTaxDocumentByDefault = dto.wantsTaxDocumentByDefault;
    }

    if (dto.country !== undefined) {
      dataToUpdate.country = dto.country;

      if (dto.country === 'CL') {
        dataToUpdate.timezone = 'America/Santiago';
      } else {
        const country = ct.getCountry(dto.country);

        if (country?.timezones?.length) {
          dataToUpdate.timezone = country.timezones[0];
        }
      }
    }

    // USER
    await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    // PROFESSIONAL
    await this.prisma.professional.updateMany({
      where: {
        userId: userId,
      },

      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),

        ...(dto.image !== undefined && {
          image: dto.image,
        }),

        ...(dto.specialty !== undefined && {
          specialty: dto.specialty,
        }),

        ...(dto.professionId !== undefined && {
          professionId: dto.professionId || null,
        }),

        ...(dto.description !== undefined && {
          description: dto.description,
        }),

        ...(dto.price !== undefined && {
          price: dto.price,
        }),

        ...(dto.duration !== undefined && {
          duration: dto.duration,
        }),

        ...(dto.taxId !== undefined && {
          taxId: dto.taxId,
        }),

        ...(dto.taxName !== undefined && {
          taxName: dto.taxName,
        }),

        ...(dto.taxEmail !== undefined && {
          taxEmail: dto.taxEmail,
        }),

        ...(dto.taxAddress !== undefined && {
          taxAddress: dto.taxAddress,
        }),

        ...(dto.taxCountry !== undefined && {
          taxCountry: dto.taxCountry,
        }),

        ...(dto.taxCity !== undefined && {
          taxCity: dto.taxCity,
        }),

        ...(dto.documentAutomationEnabled !== undefined && {
          documentAutomationEnabled: dto.documentAutomationEnabled,
        }),

        ...(dto.manualDocumentMode !== undefined && {
          manualDocumentMode: dto.manualDocumentMode,
        }),

        ...(dto.taxProvider !== undefined && {
          taxProvider: dto.taxProvider,
        }),

        ...(dto.attentionMode !== undefined && {
          attentionMode: dto.attentionMode,
        }),

        ...(dto.officeAddress !== undefined && {
          officeAddress: dto.officeAddress,
        }),

        ...(dto.officeCity !== undefined && {
          officeCity: dto.officeCity,
        }),

        ...(dto.officeRegion !== undefined && {
          officeRegion: dto.officeRegion,
        }),

        ...(dto.officeCountry !== undefined && {
          officeCountry: dto.officeCountry,
        }),

        ...(dto.officeLatitude !== undefined && {
          officeLatitude: dto.officeLatitude,
        }),

        ...(dto.officeLongitude !== undefined && {
          officeLongitude: dto.officeLongitude,
        }),

        ...(dto.arrivalInstructions !== undefined && {
          arrivalInstructions: dto.arrivalInstructions,
        }),

        ...(dto.videoProvider !== undefined && {
          videoProvider: dto.videoProvider,
        }),

        ...(dto.customVideoUrl !== undefined && {
          customVideoUrl: dto.customVideoUrl,
        }),
      },
    });

    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        professional: {
          include: {
            profession: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }
  async updateSessionDuration(userId: string, duration: number) {
    if (duration < 15 || duration > 180) {
      throw new ForbiddenException(
        'Session duration must be between 15 and 180 minutes',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { sessionDuration: duration },
    });
  }
  async findProfessionals(params: FindProfessionalsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 12));
    const search = params.search?.trim();
    const specialty = params.specialty?.trim();
    const professionId = params.professionId?.trim();
    const professionSlug = params.professionSlug?.trim();
    const categorySlug = params.categorySlug?.trim();
    const attentionMode = params.attentionMode?.trim();
    const legacyCatalogTerms: string[] = [];

    if (professionSlug) {
      const profession = await this.prisma.profession.findUnique({
        where: { slug: professionSlug },
        select: { name: true, slug: true, aliases: true },
      });

      if (profession) {
        legacyCatalogTerms.push(profession.name, profession.slug, ...profession.aliases);
      }
    }

    if (categorySlug) {
      const professions = await this.prisma.profession.findMany({
        where: {
          category: { slug: categorySlug, isActive: true },
          isActive: true,
        },
        select: { name: true, slug: true, aliases: true },
      });

      legacyCatalogTerms.push(
        ...professions.flatMap((profession) => [
          profession.name,
          profession.slug,
          ...profession.aliases,
        ]),
      );
    }

    const where: Prisma.ProfessionalWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { specialty: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { profession: { name: { contains: search, mode: 'insensitive' } } },
        { profession: { slug: { contains: search, mode: 'insensitive' } } },
        { profession: { category: { name: { contains: search, mode: 'insensitive' } } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (specialty) {
      where.OR = [
        ...(where.OR || []),
        { specialty: { contains: specialty, mode: 'insensitive' } },
        { profession: { name: { contains: specialty, mode: 'insensitive' } } },
        { profession: { slug: { contains: specialty, mode: 'insensitive' } } },
      ];
    }

    if (professionId) {
      where.professionId = professionId;
    }

    if (professionSlug) {
      where.OR = [
        ...(where.OR || []),
        { profession: { slug: professionSlug, isActive: true } },
      ];
    }

    if (categorySlug) {
      where.OR = [
        ...(where.OR || []),
        { profession: { category: { slug: categorySlug, isActive: true } } },
      ];
    }

    if ((professionSlug || categorySlug) && legacyCatalogTerms.length) {
      where.OR = [
        ...(where.OR || []),
        ...legacyCatalogTerms.map((term) => ({
          specialty: { contains: term, mode: 'insensitive' as const },
        })),
      ];
    }

    if (
      attentionMode &&
      attentionMode !== 'ALL' &&
      ['ONLINE', 'PRESENTIAL', 'BOTH'].includes(attentionMode)
    ) {
      where.attentionMode = attentionMode as AttentionModality;
    }

    const [total, data, specialtyRows] = await this.prisma.$transaction([
      this.prisma.professional.count({ where }),
      this.prisma.professional.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }, { user: { name: 'asc' } }],
        include: {
          user: true,
          profession: {
            include: {
              category: true,
            },
          },
        },
      }),
      this.prisma.professional.findMany({
        where: { specialty: { not: null } },
        distinct: ['specialty'],
        select: { specialty: true },
        orderBy: { specialty: 'asc' },
      }),
    ]);

    return {
      data: data.map((p) => ({
        id: p.userId,
        email: p.user.email,
        name: p.name || p.user.name || 'Profesional',
        specialty: p.specialty,
        professionId: p.professionId,
        professionName: p.profession?.name || null,
        professionSlug: p.profession?.slug || null,
        categoryName: p.profession?.category?.name || null,
        categorySlug: p.profession?.category?.slug || null,
        price: p.price,
        duration: p.duration,
        image: p.image,
        documentAutomationEnabled: p.documentAutomationEnabled,
        manualDocumentMode: p.manualDocumentMode,
        taxId: p.taxId,
        taxName: p.taxName,
        taxEmail: p.taxEmail,
        taxAddress: p.taxAddress,
        taxCountry: p.taxCountry,
        taxCity: p.taxCity,
        attentionMode: p.attentionMode,
        officeAddress: p.officeAddress,
        officeCity: p.officeCity,
        officeRegion: p.officeRegion,
        officeCountry: p.officeCountry,
        officeLatitude: p.officeLatitude,
        officeLongitude: p.officeLongitude,
        arrivalInstructions: p.arrivalInstructions,
        videoProvider: p.videoProvider,
        customVideoUrl: p.customVideoUrl,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      specialties: specialtyRows
        .map((item) => item.specialty)
        .filter(Boolean),
    };
  }

  // PERFIL ACTUAL
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        professional: {
          include: {
            profession: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }
  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        country: true,
        timezone: true,
        taxId: true,
        taxName: true,
        taxEmail: true,
        taxAddress: true,
        taxCountry: true,
        taxCity: true,
        wantsTaxDocumentByDefault: true,
        customerInterests: true,
        preferredAttentionMode: true,
        preferredCity: true,
        preferredRegion: true,

        professional: {
          select: {
            id: true,
            name: true,
            specialty: true,
            professionId: true,
            profession: {
              include: {
                category: true,
              },
            },
            description: true,
            price: true,
            duration: true,
            image: true,

            bankName: true,
            accountType: true,
            accountNumber: true,
            accountHolder: true,
            accountEmail: true,
            documentAutomationEnabled: true,
            manualDocumentMode: true,
            taxProvider: true,
            taxId: true,
            taxName: true,
            taxEmail: true,
            taxAddress: true,
            taxCountry: true,
            taxCity: true,
            attentionMode: true,
            officeAddress: true,
            officeCity: true,
            officeRegion: true,
            officeCountry: true,
            officeLatitude: true,
            officeLongitude: true,
            arrivalInstructions: true,
            videoProvider: true,
            customVideoUrl: true,
          },
        },
      },
    });
  }
}

