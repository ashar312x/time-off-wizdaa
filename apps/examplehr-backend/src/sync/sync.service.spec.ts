import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { SyncService } from './sync.service';
import { Balance } from '../database/models/balance.model';
import { BalanceAuditLog } from '../database/models/balance-audit-log.model';
import { SyncRun } from '../database/models/sync-run.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { TimeOffRequest } from '../database/models/time-off-request.model';
import { HcmClientService } from '../hcm-client/hcm-client.service';

function makeSyncRun(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'run-uuid-1',
    triggeredBy: 'MANUAL',
    status: 'RUNNING',
    startedAt: new Date(),
    recordsUpdated: 0,
    recordsFailed: 0,
    completedAt: null,
    update: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

describe('SyncService', () => {
  let service: SyncService;
  let balanceModel: Record<string, jest.Mock>;
  let syncRunModel: Record<string, jest.Mock>;
  let employeeModel: Record<string, jest.Mock>;
  let locationModel: Record<string, jest.Mock>;
  let requestModel: Record<string, jest.Mock>;
  let auditModel: Record<string, jest.Mock>;
  let hcmClient: jest.Mocked<Pick<HcmClientService, 'getBalance' | 'deduct' | 'credit' | 'getBatch' | 'healthCheck'>>;
  let configService: { get: jest.Mock };

  const mockEmployee = { id: 'emp-uuid-1', hcmEmployeeId: 'hcm-emp-1' };
  const mockLocation = { id: 'loc-uuid-1', hcmLocationId: 'hcm-loc-1' };

  beforeEach(async () => {
    balanceModel = { findOne: jest.fn(), create: jest.fn(), update: jest.fn() };
    syncRunModel = { create: jest.fn(), findOne: jest.fn(), findAndCountAll: jest.fn() };
    employeeModel = { findAll: jest.fn().mockResolvedValue([mockEmployee]) };
    locationModel = { findAll: jest.fn().mockResolvedValue([mockLocation]) };
    requestModel = { findAll: jest.fn().mockResolvedValue([]) };
    auditModel = { create: jest.fn() };
    hcmClient = {
      getBalance: jest.fn(),
      deduct: jest.fn(),
      credit: jest.fn(),
      getBatch: jest.fn(),
      healthCheck: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue('60') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getModelToken(Balance), useValue: balanceModel },
        { provide: getModelToken(SyncRun), useValue: syncRunModel },
        { provide: getModelToken(Employee), useValue: employeeModel },
        { provide: getModelToken(Location), useValue: locationModel },
        { provide: getModelToken(TimeOffRequest), useValue: requestModel },
        { provide: getModelToken(BalanceAuditLog), useValue: auditModel },
        { provide: HcmClientService, useValue: hcmClient },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SyncService);
  });

  describe('scheduledSync', () => {
    it('runs sync when the interval is exactly 60 minutes', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockResolvedValue({ data: [], meta: { total: 0 } });

      await service.scheduledSync();

      expect(syncRunModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: 'SCHEDULER' }),
      );
    });

    it('skips sync when the interval is not 60 minutes', async () => {
      configService.get.mockReturnValue('30');

      await service.scheduledSync();

      expect(syncRunModel.create).not.toHaveBeenCalled();
    });
  });

  describe('runSync', () => {
    it('creates a RUNNING sync run, processes all batches, and marks COMPLETED', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockResolvedValue({
        data: [{ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 10, version: 2 }],
        meta: { total: 1 },
      });

      const existing = {
        hcmVersion: 1,
        update: jest.fn().mockResolvedValue(undefined),
      };
      balanceModel.findOne.mockResolvedValue(existing);

      await service.runSync('MANUAL');

      expect(syncRunModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: 'MANUAL', status: 'RUNNING' }),
      );
      expect(run.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED' }),
      );
    });

    it('creates a new balance record when no existing record is found', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockResolvedValue({
        data: [{ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 10, version: 1 }],
        meta: { total: 1 },
      });
      balanceModel.findOne.mockResolvedValue(null);
      balanceModel.create.mockResolvedValue({});

      await service.runSync('MANUAL');

      expect(balanceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'emp-uuid-1', locationId: 'loc-uuid-1', cachedBalanceDays: 10 }),
      );
    });

    it('skips records where employee or location is not found in the local DB', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockResolvedValue({
        data: [{ employeeId: 'unknown-hcm-id', locationId: 'hcm-loc-1', balanceDays: 10, version: 1 }],
        meta: { total: 1 },
      });

      await service.runSync('MANUAL');

      expect(balanceModel.findOne).not.toHaveBeenCalled();
    });

    it('does not update a balance whose hcmVersion is unchanged', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockResolvedValue({
        data: [{ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 10, version: 1 }],
        meta: { total: 1 },
      });

      const existing = { hcmVersion: 1, update: jest.fn().mockResolvedValue(undefined) };
      balanceModel.findOne.mockResolvedValue(existing);

      await service.runSync('MANUAL');

      // Only the lastSyncedAt/isStale update is called, not a full balance update
      expect(existing.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ cachedBalanceDays: expect.anything() }),
      );
    });

    it('marks the sync run as FAILED when getBatch throws', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockRejectedValue(new Error('HCM down'));

      await expect(service.runSync('MANUAL')).rejects.toThrow('HCM down');

      expect(run.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED', errorMessage: 'HCM down' }),
      );
    });

    it('detects drift and logs DRIFT_DETECTED when approved request has negative balance', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch.mockResolvedValue({ data: [], meta: { total: 0 } });
      requestModel.findAll.mockResolvedValue([
        { id: 'req-1', employeeId: 'emp-uuid-1', locationId: 'loc-uuid-1' },
      ]);
      balanceModel.findOne.mockResolvedValue({ cachedBalanceDays: -2 });
      auditModel.create.mockResolvedValue({});

      await service.runSync('MANUAL');

      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'DRIFT_DETECTED', source: 'SYSTEM_SYNC' }),
      );
    });

    it('paginates through multiple batches', async () => {
      const run = makeSyncRun();
      syncRunModel.create.mockResolvedValue(run);
      hcmClient.getBatch
        .mockResolvedValueOnce({
          data: Array.from({ length: 500 }, (_, i) => ({
            employeeId: 'hcm-emp-1',
            locationId: 'hcm-loc-1',
            balanceDays: i,
            version: i,
          })),
          meta: { total: 600 },
        })
        .mockResolvedValueOnce({
          data: Array.from({ length: 100 }, (_, i) => ({
            employeeId: 'hcm-emp-1',
            locationId: 'hcm-loc-1',
            balanceDays: i + 500,
            version: i + 500,
          })),
          meta: { total: 600 },
        });
      balanceModel.findOne.mockResolvedValue({ hcmVersion: -1, update: jest.fn() });

      await service.runSync('MANUAL');

      expect(hcmClient.getBatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStatus', () => {
    it('returns the last sync run and calculated next scheduled time', async () => {
      const completedAt = new Date();
      const lastRun = makeSyncRun({ status: 'COMPLETED', completedAt });
      syncRunModel.findOne.mockResolvedValue(lastRun);
      configService.get.mockReturnValue('60');

      const result = await service.getStatus();

      expect(result.lastRun).toBe(lastRun);
      expect(result.nextScheduledSync).toBeInstanceOf(Date);
    });

    it('returns null for nextScheduledSync when there is no last run', async () => {
      syncRunModel.findOne.mockResolvedValue(null);

      const result = await service.getStatus();

      expect(result.lastRun).toBeNull();
      expect(result.nextScheduledSync).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('returns paginated sync run history', async () => {
      const rows = [makeSyncRun()];
      syncRunModel.findAndCountAll.mockResolvedValue({ rows, count: 1 });

      const result = await service.getHistory(1, 20);

      expect(result.data).toEqual(rows);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('applies the correct offset for page 3', async () => {
      syncRunModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      await service.getHistory(3, 10);

      expect(syncRunModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 20, limit: 10 }),
      );
    });
  });
});
