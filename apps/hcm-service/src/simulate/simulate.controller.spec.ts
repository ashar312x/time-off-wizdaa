import { Test, TestingModule } from '@nestjs/testing';
import { SimulateController } from './simulate.controller';
import { SimulateService } from './simulate.service';

describe('SimulateController', () => {
  let controller: SimulateController;

  const mockSimulateService = {
    anniversaryBonus: jest.fn(),
    yearReset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulateController],
      providers: [{ provide: SimulateService, useValue: mockSimulateService }],
    }).compile();

    controller = module.get<SimulateController>(SimulateController);
    jest.clearAllMocks();
  });

  // ─── anniversary ─────────────────────────────────────────────────────────────

  describe('anniversary', () => {
    it('returns { data, error: null } on success', async () => {
      const data = { employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 15, version: 2 };
      mockSimulateService.anniversaryBonus.mockResolvedValue(data);

      const result = await controller.anniversary({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        bonusDays: 5,
      });

      expect(result).toEqual({ data, error: null });
    });

    it('passes employeeId, locationId, and bonusDays to service', async () => {
      mockSimulateService.anniversaryBonus.mockResolvedValue({});

      await controller.anniversary({
        employeeId: 'emp-2',
        locationId: 'loc-3',
        bonusDays: 10,
      });

      expect(mockSimulateService.anniversaryBonus).toHaveBeenCalledWith('emp-2', 'loc-3', 10);
    });

    it('returns { data: null, error: null } when service returns null (balance not found)', async () => {
      mockSimulateService.anniversaryBonus.mockResolvedValue(null);

      const result = await controller.anniversary({
        employeeId: 'emp-x',
        locationId: 'loc-x',
        bonusDays: 5,
      });

      expect(result).toEqual({ data: null, error: null });
    });

    it('propagates exceptions thrown by the service', async () => {
      mockSimulateService.anniversaryBonus.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.anniversary({ employeeId: 'emp-1', locationId: 'loc-1', bonusDays: 5 }),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── yearReset ───────────────────────────────────────────────────────────────

  describe('yearReset', () => {
    it('returns { data, error: null } on success', async () => {
      const data = { updated: 4, resetValue: 20 };
      mockSimulateService.yearReset.mockResolvedValue(data);

      const result = await controller.yearReset({ resetValue: 20 });

      expect(result).toEqual({ data, error: null });
    });

    it('passes resetValue to service', async () => {
      mockSimulateService.yearReset.mockResolvedValue({ updated: 0, resetValue: 10 });

      await controller.yearReset({ resetValue: 10 });

      expect(mockSimulateService.yearReset).toHaveBeenCalledWith(10);
    });

    it('reflects updated: 0 when no balances exist', async () => {
      mockSimulateService.yearReset.mockResolvedValue({ updated: 0, resetValue: 15 });

      const result = await controller.yearReset({ resetValue: 15 });

      expect(result.data.updated).toBe(0);
    });

    it('propagates exceptions thrown by the service', async () => {
      mockSimulateService.yearReset.mockRejectedValue(new Error('DB error'));

      await expect(controller.yearReset({ resetValue: 10 })).rejects.toThrow('DB error');
    });
  });
});
