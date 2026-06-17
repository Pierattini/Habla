import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import ct from 'countries-and-timezones';
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

    // ✅ USER
    await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    // ✅ PROFESSIONAL
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
      },
    });

    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        professional: true,
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
  async findProfessionals() {
    const data = await this.prisma.professional.findMany({
      include: {
        user: true,
      },
    });

    return data.map((p) => ({
      id: p.userId,
      email: p.user.email,
      name: p.name || 'Profesional',
      specialty: p.specialty,
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
    }));
  }

  // 👇 AGREGA ESTO ABAJO
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        professional: true,
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

        professional: {
          select: {
            id: true,
            name: true,
            specialty: true,
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
          },
        },
      },
    });
  }
}
