import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MessagesGateway } from './messages.gateway';
import { EmailService } from '../email/email.service';
import { ProfessionalAccessService } from '../appointment-requests/professional-access.service';
import { ContactProtectionService } from './contact-protection.service';

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: CloudinaryService,
          useValue: {},
        },
        {
          provide: MessagesGateway,
          useValue: {},
        },
        {
          provide: EmailService,
          useValue: {},
        },
        {
          provide: ProfessionalAccessService,
          useValue: {},
        },
        ContactProtectionService,
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
