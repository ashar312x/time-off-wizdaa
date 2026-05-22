import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Op } from 'sequelize';
import { BalanceService } from './balance.service';
import { HcmBalance } from '../database/models/hcm-balance.model';
import { HcmBalanceEvent } from '../database/models/hcm-balance-event.model';
import { HcmDeductionRef } from '../database/models/hcm-deduction-ref.model';

function makeBalance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'balance-id-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    balanceDays: 10,
    version: 1,
    lastModified: new Date(),
    ...overrides,
  };
}

describe('BalanceService', () => {
  let service: BalanceService;

  const mockBalanceModel = {
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
  };

  const mockEventModel = {
    create: jest.fn(),
  };

  const mockRefModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getModelToken(HcmBalance), useValue: mockBalanceModel },
        { provide: getModelToken(HcmBalanceEvent), useValue: mockEventModel },
        { provide: getModelToken(HcmDeductionRef), useValue: mockRefModel },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    jest.clearAllMocks();
  });

  // ─── getBalance ──────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns balance data for a valid employee/location', async () => {
      mockBalanceModel.findOne.mockResolvedValue(makeBalance());

      const result = await service.getBalance('emp-1', 'loc-1');

      expect(mockBalanceModel.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', locationId: 'loc-1' },
      });
      expect(result).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 10,
        version: 1,
      });
    });

    it('throws UnprocessableEntityException with INVALID_COMBINATION when not found', async () => {
      mockBalanceModel.findOne.mockResolvedValue(null);

      await expect(service.getBalance('emp-x', 'loc-x')).rejects.toMatchObject({
        response: {
          error: 'INVALID_COMBINATION',
          message: 'Invalid employee/location combination',
        },
      });
    });

    it('throws UnprocessableEntityException (not NotFoundException) for missing balance', async () => {
      mockBalanceModel.findOne.mockResolvedValue(null);

      await expect(service.getBalance('emp-x', 'loc-x')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // ─── deduct ──────────────────────────────────────────────────────────────────

  describe('deduct', () => {
    it('deducts days and returns updated balance and version', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.deduct('emp-1', 'loc-1', 4);

      expect(result).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 6,
        version: 2,
      });
    });

    it('uses optimistic locking — update WHERE includes current version', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 3 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.deduct('emp-1', 'loc-1', 2);

      expect(mockBalanceModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ balanceDays: 8, version: 4 }),
        { where: { id: 'balance-id-1', version: 3 } },
      );
    });

    it('creates a DEDUCTION event triggered by EXAMPLEHR', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.deduct('emp-1', 'loc-1', 3);

      expect(mockEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          eventType: 'DEDUCTION',
          deltaDays: -3,
          triggeredBy: 'EXAMPLEHR',
        }),
      );
    });

    it('saves a deduction ref record when referenceId is provided', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});
      mockRefModel.create.mockResolvedValue({});

      await service.deduct('emp-1', 'loc-1', 5, 'ref-123');

      expect(mockRefModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceId: 'ref-123',
          employeeId: 'emp-1',
          locationId: 'loc-1',
          days: 5,
          operation: 'DEDUCT',
          balanceAfter: 5,
          versionAfter: 2,
        }),
      );
    });

    it('does not save a ref record when no referenceId is given', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.deduct('emp-1', 'loc-1', 5);

      expect(mockRefModel.create).not.toHaveBeenCalled();
    });

    it('allows deducting the full balance (result = 0)', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 5, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.deduct('emp-1', 'loc-1', 5);

      expect(result.balanceDays).toBe(0);
    });

    it('deducts decimal days correctly', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10.5, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.deduct('emp-1', 'loc-1', 0.5);

      expect(result.balanceDays).toBeCloseTo(10);
    });

    it('throws INSUFFICIENT_BALANCE when requested days exceed balance', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 3 }));

      await expect(service.deduct('emp-1', 'loc-1', 5)).rejects.toMatchObject({
        response: { error: 'INSUFFICIENT_BALANCE', availableDays: 3 },
      });
    });

    it('throws INVALID_COMBINATION when balance record does not exist', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(null);

      await expect(service.deduct('emp-x', 'loc-x', 5)).rejects.toMatchObject({
        response: { error: 'INVALID_COMBINATION' },
      });
    });

    it('throws VERSION_CONFLICT (ConflictException) when update returns 0 rows', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([0]);

      await expect(service.deduct('emp-1', 'loc-1', 5)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.deduct('emp-1', 'loc-1', 5)).rejects.toMatchObject({
        response: { error: 'VERSION_CONFLICT' },
      });
    });

    it('returns cached result on idempotent retry without hitting the DB again', async () => {
      const existingRef = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceAfter: 5,
        versionAfter: 2,
      };
      mockRefModel.findOne.mockResolvedValue(existingRef);

      const result = await service.deduct('emp-1', 'loc-1', 5, 'ref-123');

      expect(mockBalanceModel.findOne).not.toHaveBeenCalled();
      expect(mockBalanceModel.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 5,
        version: 2,
      });
    });

    it('idempotency query uses DEDUCT operation filter and 24h window', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});
      mockRefModel.create.mockResolvedValue({});

      const before = Date.now();
      await service.deduct('emp-1', 'loc-1', 5, 'ref-123');

      const call = mockRefModel.findOne.mock.calls[0][0];
      expect(call.where.referenceId).toBe('ref-123');
      expect(call.where.operation).toBe('DEDUCT');
      const windowStart: Date = call.where.createdAt[Op.gte];
      expect(windowStart.getTime()).toBeGreaterThanOrEqual(
        before - 24 * 60 * 60 * 1000 - 100,
      );
    });

    it('does not check idempotency when referenceId is omitted', async () => {
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.deduct('emp-1', 'loc-1', 5);

      expect(mockRefModel.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── credit ──────────────────────────────────────────────────────────────────

  describe('credit', () => {
    it('credits days and returns updated balance and version', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.credit('emp-1', 'loc-1', 5);

      expect(result).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 15,
        version: 2,
      });
    });

    it('update WHERE only uses id — no version check (no optimistic lock)', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.credit('emp-1', 'loc-1', 5);

      expect(mockBalanceModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ balanceDays: 15, version: 2 }),
        { where: { id: 'balance-id-1' } },
      );
    });

    it('creates a CREDIT event triggered by EXAMPLEHR', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.credit('emp-1', 'loc-1', 5);

      expect(mockEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          eventType: 'CREDIT',
          deltaDays: 5,
          triggeredBy: 'EXAMPLEHR',
        }),
      );
    });

    it('saves a credit ref record when referenceId is provided', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});
      mockRefModel.create.mockResolvedValue({});

      await service.credit('emp-1', 'loc-1', 5, 'ref-credit-1');

      expect(mockRefModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceId: 'ref-credit-1',
          operation: 'CREDIT',
          balanceAfter: 15,
          versionAfter: 2,
        }),
      );
    });

    it('does not save a ref record when no referenceId is given', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      await service.credit('emp-1', 'loc-1', 5);

      expect(mockRefModel.create).not.toHaveBeenCalled();
    });

    it('throws INVALID_COMBINATION when balance record does not exist', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(null);

      await expect(service.credit('emp-x', 'loc-x', 5)).rejects.toMatchObject({
        response: { error: 'INVALID_COMBINATION' },
      });
    });

    it('credits a zero-balance account to a positive value', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 0, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.credit('emp-1', 'loc-1', 10);

      expect(result.balanceDays).toBe(10);
    });

    it('returns cached result on idempotent retry without hitting the DB again', async () => {
      mockRefModel.findOne.mockResolvedValue({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceAfter: 15,
        versionAfter: 2,
      });

      const result = await service.credit('emp-1', 'loc-1', 5, 'ref-credit-1');

      expect(mockBalanceModel.findOne).not.toHaveBeenCalled();
      expect(result).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 15,
        version: 2,
      });
    });

    it('idempotency query uses CREDIT operation filter', async () => {
      mockRefModel.findOne.mockResolvedValue(null);
      mockBalanceModel.findOne.mockResolvedValue(makeBalance({ balanceDays: 10, version: 1 }));
      mockBalanceModel.update.mockResolvedValue([1]);
      mockEventModel.create.mockResolvedValue({});
      mockRefModel.create.mockResolvedValue({});

      await service.credit('emp-1', 'loc-1', 5, 'ref-credit-1');

      const call = mockRefModel.findOne.mock.calls[0][0];
      expect(call.where.operation).toBe('CREDIT');
    });
  });

  // ─── getBatch ────────────────────────────────────────────────────────────────

  describe('getBatch', () => {
    it('returns paginated list with correct meta for page 1', async () => {
      const rows = [
        makeBalance({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10, version: 1 }),
        makeBalance({ id: 'b2', employeeId: 'emp-2', locationId: 'loc-1', balanceDays: 5, version: 3 }),
      ];
      mockBalanceModel.findAndCountAll.mockResolvedValue({ rows, count: 2 });

      const result = await service.getBatch(1, 500);

      expect(mockBalanceModel.findAndCountAll).toHaveBeenCalledWith({
        limit: 500,
        offset: 0,
        order: [['employeeId', 'ASC']],
      });
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 500 });
    });

    it('calculates offset correctly for page 2 with limit 10', async () => {
      mockBalanceModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      await service.getBatch(2, 10);

      expect(mockBalanceModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 10 }),
      );
    });

    it('calculates offset correctly for page 3 with limit 5', async () => {
      mockBalanceModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      await service.getBatch(3, 5);

      expect(mockBalanceModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 10 }),
      );
    });

    it('maps each row to the expected DTO shape', async () => {
      const rows = [makeBalance({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 7, version: 4 })];
      mockBalanceModel.findAndCountAll.mockResolvedValue({ rows, count: 1 });

      const result = await service.getBatch(1, 500);

      expect(result.data[0]).toEqual({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 7,
        version: 4,
      });
    });

    it('uses defaults (page=1, limit=500) when called with no arguments', async () => {
      mockBalanceModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      await service.getBatch();

      expect(mockBalanceModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 500, offset: 0 }),
      );
    });

    it('returns empty data array and total=0 when no balances exist', async () => {
      mockBalanceModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      const result = await service.getBatch(1, 500);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });
});
