import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../../core/config/api.config';
import { ProfessionalTimeBlocksStore } from './professional-time-blocks.store';

describe('ProfessionalTimeBlocksStore', () => {
  let store: ProfessionalTimeBlocksStore;
  let http: HttpTestingController;
  const block = {
    id: 'block-1', professionalId: 'professional-1', type: 'TIME_RANGE' as const,
    startAt: '2099-08-18T13:00:00.000Z', endAt: '2099-08-18T14:00:00.000Z',
    reason: 'Asunto personal', createdAt: '', updatedAt: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(ProfessionalTimeBlocksStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and orders blocks', async () => {
    const promise = store.loadBlocks();
    http.expectOne(`${API_URL}/professional-time-blocks`).flush([block]);
    await promise;
    expect(store.blocks()).toEqual([block]);
    expect(store.initialized()).toBe(true);
  });

  it('creates a block and reflects it immediately', async () => {
    const payload = { type: block.type, startAt: block.startAt, endAt: block.endAt, reason: block.reason };
    const promise = store.createBlock(payload);
    http.expectOne(`${API_URL}/professional-time-blocks`).flush(block);
    expect(await promise).toBe(true);
    expect(store.blocks()).toEqual([block]);
  });

  it('deletes a block locally without reloading', async () => {
    const load = store.loadBlocks();
    http.expectOne(`${API_URL}/professional-time-blocks`).flush([block]);
    await load;
    const deletion = store.deleteBlock(block.id);
    http.expectOne(`${API_URL}/professional-time-blocks/${block.id}`).flush({ deleted: true });
    expect(await deletion).toBe(true);
    expect(store.blocks()).toEqual([]);
  });

  it('translates appointment conflicts without exposing technical errors', async () => {
    const promise = store.createBlock({ type: block.type, startAt: block.startAt, endAt: block.endAt });
    http.expectOne(`${API_URL}/professional-time-blocks`).flush(
      { message: 'El horario se solapa con otra cita. Prisma P2002' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(await promise).toBe(false);
    expect(store.error()).toBe('Ese horario ya tiene una cita y no puede bloquearse.');
  });
});

