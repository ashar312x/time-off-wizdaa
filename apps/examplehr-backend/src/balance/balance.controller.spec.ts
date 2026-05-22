import { Test, TestingModule } from '@nestjs/testing';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';

const mockBalances = [
  { locationId: 'loc-1', locationName: 'New York HQ', cachedBalanceDays: 10, isStale: false, lastSyncedAt: new Date() },
];

describe('BalanceController', () => {
  let controller: BalanceController;
  let balanceService: jest.Mocked<Pick<BalanceService, 'getBalancesForEmployee' | 'forceSync'>>;

  beforeEach(async () => {
    balanceService = {
      getBalancesForEmployee: jest.fn().mockResolvedValue(mockBalances),
      forceSync: jest.fn().mockResolvedValue({ cachedBalanceDays: 15 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [{ provide: BalanceService, useValue: balanceService }],
    }).compile();

    controller = module.get(BalanceController);
  });

  describe('getMyBalances', () => {
    it('returns balances for the authenticated user', async () => {
      const req = { user: { id: 'emp-1' } };

      const result = await controller.getMyBalances(req);

      expect(balanceService.getBalancesForEmployee).toHaveBeenCalledWith('emp-1');
      expect(result).toEqual(mockBalances);
    });
  });

  describe('getEmployeeBalances', () => {
    it('returns balances for the given employee id', async () => {
      const result = await controller.getEmployeeBalances('emp-2');

      expect(balanceService.getBalancesForEmployee).toHaveBeenCalledWith('emp-2');
      expect(result).toEqual(mockBalances);
    });
  });

  describe('forceSync', () => {
    it('triggers a sync for the given employee and location', async () => {
      const result = await controller.forceSync('emp-1', 'loc-1');

      expect(balanceService.forceSync).toHaveBeenCalledWith('emp-1', 'loc-1');
      expect(result).toEqual({ cachedBalanceDays: 15 });
    });
  });
});
