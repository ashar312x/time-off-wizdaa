import { Test, TestingModule } from '@nestjs/testing';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

const mockSyncRun = {
  id: 'run-1',
  triggeredBy: 'MANUAL',
  status: 'COMPLETED',
  recordsUpdated: 5,
  startedAt: new Date(),
  completedAt: new Date(),
};

describe('SyncController', () => {
  let controller: SyncController;
  let syncService: jest.Mocked<Pick<SyncService, 'getStatus' | 'runSync' | 'getHistory'>>;

  beforeEach(async () => {
    syncService = {
      getStatus: jest.fn().mockResolvedValue({ lastRun: mockSyncRun, nextScheduledSync: new Date() }),
      runSync: jest.fn().mockResolvedValue(mockSyncRun),
      getHistory: jest.fn().mockResolvedValue({ data: [mockSyncRun], meta: { total: 1, page: 1, limit: 20 } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: syncService }],
    }).compile();

    controller = module.get(SyncController);
  });

  describe('getStatus', () => {
    it('returns the current sync status', async () => {
      const result = await controller.getStatus();

      expect(syncService.getStatus).toHaveBeenCalled();
      expect(result).toMatchObject({ lastRun: mockSyncRun });
    });
  });

  describe('trigger', () => {
    it('starts a manual sync and returns the sync run record', async () => {
      const result = await controller.trigger();

      expect(syncService.runSync).toHaveBeenCalledWith('MANUAL');
      expect(result).toEqual(mockSyncRun);
    });
  });

  describe('getHistory', () => {
    it('returns paginated sync history with default page and limit', async () => {
      const result = await controller.getHistory('1', '20');

      expect(syncService.getHistory).toHaveBeenCalledWith(1, 20);
      expect(result.data).toEqual([mockSyncRun]);
    });

    it('parses page and limit query params as integers', async () => {
      await controller.getHistory('3', '5');

      expect(syncService.getHistory).toHaveBeenCalledWith(3, 5);
    });
  });
});
