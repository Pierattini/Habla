import { Role } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService customer search', () => {
  it('only searches active, non-deleted CUSTOMER users with limited safe fields', async () => {
    const prisma:any = { user:{ findMany:jest.fn().mockResolvedValue([]) } };
    const service = new UsersService(prisma);
    await service.searchActiveCustomers(' caro ');
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:expect.objectContaining({ role:Role.CUSTOMER, isActive:true, deletedAt:null }),
      select:{ id:true, name:true, email:true }, take:10,
    }));
  });

  it('does not enumerate customers without a meaningful query', async () => {
    const prisma:any = { user:{ findMany:jest.fn() } };
    const service = new UsersService(prisma);
    expect(service.searchActiveCustomers('a')).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
