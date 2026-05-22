import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';

describe('BalanceController', () => {
  let controller: BalanceController;

  const mockBalanceService = {
    getBalance: jest.fn(),
    deduct: jest.fn(),
    credit: jest.fn(),
    getBatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [{ provide: BalanceService, useValue: mockBalanceService }],
    }).compile();

    controller = module.get<BalanceController>(BalanceController);
    jest.clearAllMocks();
  });

  // ─── getBatch ────────────────────────────────────────────────────────────────

  describe('getBatch', () => {
    it('returns { data, meta, error: null } wrapping service result', async () => {
      const serviceResult = {
        data: [{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10, version: 1 }],
        meta: { total: 1, page: 1, limit: 500 },
      };
      mockBalanceService.getBatch.mockResolvedValue(serviceResult);

      const result = await controller.getBatch('1', '500');

      expect(result).toEqual({ data: serviceResult.data, meta: serviceResult.meta, error: null });
    });

    it('calls service with parsed integers from query strings', async () => {
      mockBalanceService.getBatch.mockResolvedValue({ data: [], meta: { total: 0, page: 2, limit: 10 } });

      await controller.getBatch('2', '10');

      expect(mockBalanceService.getBatch).toHaveBeenCalledWith(2, 10);
    });

    it('uses defaults (page=1, limit=500) when query params are omitted', async () => {
      mockBalanceService.getBatch.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 500 } });

      await controller.getBatch();

      expect(mockBalanceService.getBatch).toHaveBeenCalledWith(1, 500);
    });
  });

  // ─── getBalance ──────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns { data, error: null } wrapping service result', async () => {
      const balanceData = { employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10, version: 1 };
      mockBalanceService.getBalance.mockResolvedValue(balanceData);

      const result = await controller.getBalance('emp-1', 'loc-1');

      expect(result).toEqual({ data: balanceData, error: null });
      expect(mockBalanceService.getBalance).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('propagates INVALID_COMBINATION exception from service', async () => {
      mockBalanceService.getBalance.mockRejectedValue(
        new UnprocessableEntityException({ error: 'INVALID_COMBINATION' }),
      );

      await expect(controller.getBalance('emp-x', 'loc-x')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // ─── deduct ──────────────────────────────────────────────────────────────────

  describe('deduct', () => {
    it('returns { data, error: null } wrapping service result', async () => {
      const resultData = { employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5, version: 2 };
      mockBalanceService.deduct.mockResolvedValue(resultData);

      const result = await controller.deduct('emp-1', 'loc-1', { days: 5 });

      expect(result).toEqual({ data: resultData, error: null });
    });

    it('passes days and undefined referenceId to service when referenceId omitted', async () => {
      mockBalanceService.deduct.mockResolvedValue({});

      await controller.deduct('emp-1', 'loc-1', { days: 5 });

      expect(mockBalanceService.deduct).toHaveBeenCalledWith('emp-1', 'loc-1', 5, undefined);
    });

    it('passes referenceId to service when provided in body', async () => {
      mockBalanceService.deduct.mockResolvedValue({});

      await controller.deduct('emp-1', 'loc-1', { days: 5, referenceId: 'ref-abc' });

      expect(mockBalanceService.deduct).toHaveBeenCalledWith('emp-1', 'loc-1', 5, 'ref-abc');
    });

    it('propagates INSUFFICIENT_BALANCE exception from service', async () => {
      mockBalanceService.deduct.mockRejectedValue(
        new UnprocessableEntityException({ error: 'INSUFFICIENT_BALANCE' }),
      );

      await expect(controller.deduct('emp-1', 'loc-1', { days: 100 })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('propagates VERSION_CONFLICT exception from service', async () => {
      mockBalanceService.deduct.mockRejectedValue(
        new ConflictException({ error: 'VERSION_CONFLICT' }),
      );

      await expect(controller.deduct('emp-1', 'loc-1', { days: 5 })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ─── credit ──────────────────────────────────────────────────────────────────

  describe('credit', () => {
    it('returns { data, error: null } wrapping service result', async () => {
      const resultData = { employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 15, version: 2 };
      mockBalanceService.credit.mockResolvedValue(resultData);

      const result = await controller.credit('emp-1', 'loc-1', { days: 5 });

      expect(result).toEqual({ data: resultData, error: null });
    });

    it('passes days and undefined referenceId to service when referenceId omitted', async () => {
      mockBalanceService.credit.mockResolvedValue({});

      await controller.credit('emp-1', 'loc-1', { days: 5 });

      expect(mockBalanceService.credit).toHaveBeenCalledWith('emp-1', 'loc-1', 5, undefined);
    });

    it('passes referenceId to service when provided in body', async () => {
      mockBalanceService.credit.mockResolvedValue({});

      await controller.credit('emp-1', 'loc-1', { days: 5, referenceId: 'ref-xyz' });

      expect(mockBalanceService.credit).toHaveBeenCalledWith('emp-1', 'loc-1', 5, 'ref-xyz');
    });

    it('propagates INVALID_COMBINATION exception from service', async () => {
      mockBalanceService.credit.mockRejectedValue(
        new UnprocessableEntityException({ error: 'INVALID_COMBINATION' }),
      );

      await expect(controller.credit('emp-x', 'loc-x', { days: 5 })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });
});
