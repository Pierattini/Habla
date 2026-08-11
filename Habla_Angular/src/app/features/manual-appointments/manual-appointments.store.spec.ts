import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../core/config/api.config';
import { ManualAppointmentsStore } from './manual-appointments.store';

describe('ManualAppointmentsStore', () => {
  let store: ManualAppointmentsStore;
  let http: HttpTestingController;
  const customer = { id:'customer-1', name:'Carolina', email:'carolina@example.com' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers:[provideHttpClient(),provideHttpClientTesting()] });
    store = TestBed.inject(ManualAppointmentsStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('searches and selects a registered customer', async () => {
    const promise = store.searchCustomers('carolina');
    http.expectOne((request) => request.url === `${API_URL}/users/customers/search` && request.params.get('q') === 'carolina').flush([customer]);
    await promise;
    store.selectCustomer(customer);
    expect(store.selectedCustomer()).toEqual(customer);
  });

  it('loads real available slots for the authenticated professional', async () => {
    const promise = store.loadSlots('2099-08-18');
    http.expectOne((request) => request.url === `${API_URL}/appointments/manual/available-slots`).flush(['09:00','10:00']);
    await promise;
    expect(store.availableSlots()).toEqual(['09:00','10:00']);
  });

  it('creates a manual appointment without sending professionalId, price or status', async () => {
    store.selectCustomer(customer); store.selectedDate.set('2099-08-18'); store.selectedSlot.set('09:00');
    const promise = store.createAppointment();
    const request = http.expectOne(`${API_URL}/appointments/manual`);
    expect(request.request.body.customerId).toBe(customer.id);
    expect(request.request.body.professionalId).toBeUndefined();
    expect(request.request.body.price).toBeUndefined();
    expect(request.request.body.status).toBeUndefined();
    request.flush({ id:'manual-1', customerId:customer.id, professionalId:'professional-1', date:'2099-08-18T07:00:00.000Z', status:'CONFIRMED', source:'PROFESSIONAL_MANUAL' });
    expect((await promise)?.source).toBe('PROFESSIONAL_MANUAL');
    expect(store.success()).toBe('Cita creada correctamente.');
  });

  it('keeps the selected catalog service in slot and appointment requests', async () => {
    store.selectedServiceId.set('service-1');
    const slotsPromise = store.loadSlots('2099-08-18');
    http.expectOne((request) =>
      request.url === `${API_URL}/appointments/manual/available-slots` &&
      request.params.get('serviceId') === 'service-1',
    ).flush(['09:00']);
    await slotsPromise;

    store.selectCustomer(customer);
    store.selectedSlot.set('09:00');
    const createPromise = store.createAppointment();
    const request = http.expectOne(`${API_URL}/appointments/manual`);
    expect(request.request.body).toEqual(expect.objectContaining({
      customerId: customer.id,
      serviceId: 'service-1',
    }));
    request.flush({ id:'manual-1', customerId:customer.id, professionalId:'professional-1', date:'2099-08-18T07:00:00.000Z', status:'CONFIRMED', source:'PROFESSIONAL_MANUAL' });
    await createPromise;
  });

  it('shows a friendly conflict and keeps technical details hidden', async () => {
    store.selectCustomer(customer); store.selectedDate.set('2099-08-18'); store.selectedSlot.set('09:00');
    const promise = store.createAppointment();
    http.expectOne(`${API_URL}/appointments/manual`).flush({ message:'El horario se solapa. Prisma P2002' },{ status:409,statusText:'Conflict' });
    await promise;
    expect(store.error()).toBe('Ese horario acaba de dejar de estar disponible. Selecciona otro.');
    expect(store.error()).not.toContain('Prisma');
  });
});
