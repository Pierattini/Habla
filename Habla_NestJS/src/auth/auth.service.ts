import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AttentionModality, Role } from '@prisma/client';

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  customerInterests?: string[];
  preferredAttentionMode?: AttentionModality;
  specialty?: string;
  professionId?: string;
  attentionMode?: AttentionModality;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ðŸ” LOGIN
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // REGISTER
  async register(data: RegisterInput) {
    const role = data.role ?? Role.CUSTOMER;
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const customerInterests = Array.isArray(data.customerInterests)
      ? data.customerInterests.filter(Boolean)
      : [];

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role,
        isActive: true,
        ...(role === Role.CUSTOMER && {
          customerInterests,
          preferredAttentionMode: data.preferredAttentionMode ?? null,
        }),
        ...(role === Role.PROFESSIONAL && {
          professional: {
            create: {
              name: data.name,
              specialty: data.specialty || null,
              professionId: data.professionId || null,
              attentionMode: data.attentionMode ?? AttentionModality.ONLINE,
            },
          },
        }),
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  // OBTENER USUARIO REAL
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },

      include: {
        professional: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
  async updateUser(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}

