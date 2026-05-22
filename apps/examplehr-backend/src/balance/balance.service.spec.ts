import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BalanceService } from './balance.service';
import { Balance } from '../database/models/balance.model';
import { BalanceAuditLog } from '../database/models/balance-audit-log.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { HcmClientService } from '../hcm-client/hcm-client.service';

const mockLocation = { id: 'loc-uuid-1', name: 'New York HQ', hcmLocationId: 'hcm-loc-1' };
const mockEmployee = { id: 'emp-uuid-1', fullName: 'Alice', hcmEmployeeId: 'hcm-emp-1' };
const now = new Date();

function makeBalance(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bal-uuid-1',
    employeeId: 'emp-uuid-1',
    locationId: 'loc-uuid-1',
    cachedBalanceDays: 10,
    hcmVersion: 1,
    lastSyncedAt: now,
    isStale: false,
    updatedAt: now,
    update: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceModel: Record<string, jest.Mock>;
  let auditModel: Record<string, jest.Mock>;
  let employeeModel: Record<string, jest.Mock>;
  let locationModel: Record<string, jest.Mock>;
  let hcmClient: jest.Mocked<Pick<HcmClientService, 'getBalance' | 'deduct' | 'credit' | 'getBatch' | 'healthCheck'>>;
  let sequelizeMock: { transaction: jest.Mock };

  beforeEach(async () => {
    balanceModel = { findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), create: jest.fn(), findByPk: jest.fn() };
    auditModel = { create: jest.fn() };
    employeeModel = { findByPk: jest.fn() };
    locationModel = { findAll: jest.fn().mockResolvedValue([mockLocation]), findByPk: jest.fn() };
    hcmClient = { getBalance: jest.fn(), deduct: jest.fn(), credit: jest.fn(), getBatch: jest.fn(), healthCheck: jest.fn() };
    sequelizeMock = {
      transaction: jest.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
        fn({ LOCK: { UPDATE: 'UPDATE' } }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getModelToken(Balance), useValue: balanceModel },
        { provide: getModelToken(BalanceAuditLog), useValue: auditModel },
        { provide: getModelToken(Employee), useValue: employeeModel },
        { provide: getModelToken(Location), useValue: locationModel },
        { provide: HcmClientService, useValue: hcmClient },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('5') } },
        { provide: Sequelize, useValue: sequelizeMock },
      ],
    }).compile();

    service = module.get(BalanceService);
  });

  describe('getBalancesForEmployee', () => {
    it('returns balances enriched with location name', async () => {
      balanceModel.findAll.mockResolvedValue([makeBalance()]);

      const result = await service.getBalancesForEmployee('emp-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        locationId: 'loc-uuid-1',
        locationName: 'New York HQ',
        cachedBalanceDays: 10,
      });
    });

    it('reports isStale: true when the isStale flag is set on the record', async () => {
      balanceModel.findAll.mockResolvedValue([makeBalance({ isStale: true })]);

      const result = await service.getBalancesForEmployee('emp-uuid-1');

      expect(result[0].isStale).toBe(true);
    });

    it('reports isStale: true when lastSyncedAt exceeds the TTL', async () => {
      const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago, TTL is 5 min
      balanceModel.findAll.mockResolvedValue([makeBalance({ lastSyncedAt: staleDate, isStale: false })]);

      const result = await service.getBalancesForEmployee('emp-uuid-1');

      expect(result[0].isStale).toBe(true);
    });

    it('returns empty array when employee has no balance records', async () => {
      balanceModel.findAll.mockResolvedValue([]);

      const result = await service.getBalancesForEmployee('emp-uuid-1');

      expect(result).toEqual([]);
    });
  });

  describe('forceSync', () => {
    it('fetches fresh balance from HCM and updates the local record', async () => {
      const balance = makeBalance();
      balanceModel.findOne.mockResolvedValue(balance);
      employeeModel.findByPk.mockResolvedValue(mockEmployee);
      locationModel.findByPk.mockResolvedValue(mockLocation);
      hcmClient.getBalance.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 20, version: 2 });
      balance.reload.mockResolvedValue({ ...balance, cachedBalanceDays: 20 });

      const result = await service.forceSync('emp-uuid-1', 'loc-uuid-1');

      expect(hcmClient.getBalance).toHaveBeenCalledWith('hcm-emp-1', 'hcm-loc-1');
      expect(balance.update).toHaveBeenCalledWith(
        expect.objectContaining({ cachedBalanceDays: 20, hcmVersion: 2, isStale: false }),
      );
      expect(result).toBeDefined();
    });

    it('returns null when no balance record exists', async () => {
      balanceModel.findOne.mockResolvedValue(null);

      const result = await service.forceSync('emp-uuid-1', 'loc-uuid-1');

      expect(result).toBeNull();
    });
  });

  describe('decrementLocal', () => {
    it('decrements balance and creates an audit log entry, returns true', async () => {
      const balance = makeBalance();
      balanceModel.findOne.mockResolvedValue(balance);
      balanceModel.update.mockResolvedValue([1]);
      auditModel.create.mockResolvedValue({});

      const result = await service.decrementLocal('emp-uuid-1', 'loc-uuid-1', 3, 'req-1', 'EMPLOYEE', now);

      expect(result).toBe(true);
      expect(balanceModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ cachedBalanceDays: 7 }),
        expect.objectContaining({ where: expect.objectContaining({ id: 'bal-uuid-1' }) }),
      );
      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'REQUEST_DEDUCTION',
          deltaDays: -3,
          balanceBefore: 10,
          balanceAfter: 7,
        }),
        expect.any(Object),
      );
    });

    it('returns false when the balance record does not exist', async () => {
      balanceModel.findOne.mockResolvedValue(null);

      const result = await service.decrementLocal('emp-uuid-1', 'loc-uuid-1', 3, 'req-1', 'EMPLOYEE', now);

      expect(result).toBe(false);
    });

    it('returns false when optimistic lock detects a concurrent update', async () => {
      const balance = makeBalance();
      balanceModel.findOne.mockResolvedValue(balance);
      balanceModel.update.mockResolvedValue([0]); // 0 affected = stale snapshot

      const result = await service.decrementLocal('emp-uuid-1', 'loc-uuid-1', 3, 'req-1', 'EMPLOYEE', now);

      expect(result).toBe(false);
    });
  });

  describe('creditLocal', () => {
    it('adds days back to the local cache and logs the credit event', async () => {
      const balance = makeBalance();
      balanceModel.findOne.mockResolvedValue(balance);
      auditModel.create.mockResolvedValue({});

      await service.creditLocal('emp-uuid-1', 'loc-uuid-1', 5, 'req-1', 'CANCELLATION_CREDIT', 'EMPLOYEE');

      expect(balance.update).toHaveBeenCalledWith(
        expect.objectContaining({ cachedBalanceDays: 15 }),
      );
      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CANCELLATION_CREDIT',
          deltaDays: 5,
          balanceBefore: 10,
          balanceAfter: 15,
        }),
      );
    });

    it('is a no-op when no balance record is found', async () => {
      balanceModel.findOne.mockResolvedValue(null);

      await service.creditLocal('emp-uuid-1', 'loc-uuid-1', 5, 'req-1', 'CANCELLATION_CREDIT', 'EMPLOYEE');

      expect(auditModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateFromHcm', () => {
    it('updates the cached balance with HCM data', async () => {
      const balance = makeBalance();
      balanceModel.findOne.mockResolvedValue(balance);

      await service.updateFromHcm('emp-uuid-1', 'loc-uuid-1', 25, 3);

      expect(balance.update).toHaveBeenCalledWith(
        expect.objectContaining({ cachedBalanceDays: 25, hcmVersion: 3, isStale: false }),
      );
    });

    it('is a no-op when no balance record is found', async () => {
      balanceModel.findOne.mockResolvedValue(null);

      await service.updateFromHcm('emp-uuid-1', 'loc-uuid-1', 25, 3);
      // no error means it silently returned
    });
  });
});
