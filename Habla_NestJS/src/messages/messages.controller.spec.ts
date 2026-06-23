import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            getSupportSummary: jest.fn(),
            getSupportTickets: jest.fn(),
            getSupportTicketByConversation: jest.fn(),
            updateSupportTicketStatus: jest.fn(),
            getOrCreateSupportConversation: jest.fn(),
            sendMessage: jest.fn(),
            getConversations: jest.fn(),
            getConversationMessages: jest.fn(),
            markConversationAsRead: jest.fn(),
            getConversationFiles: jest.fn(),
            uploadFileToConversation: jest.fn(),
            sendMessageToConversation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
