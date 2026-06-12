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
    if (dto.image !== undefined) dataToUpdate.image = dto.image;

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
    const data = await this.prisma.professional.findMany();

    return data.map((p) => ({
      id: p.userId,
      name: p.name || 'Profesional',
      specialty: p.specialty,
      price: p.price,
      duration: p.duration,
      image: p.image,
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
          },
        },
      },
    });
  }
}
