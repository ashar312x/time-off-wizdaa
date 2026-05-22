import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SimulateService } from './simulate.service';
import { HcmBalance } from '../database/models/hcm-balance.model';
import { HcmBalanceEvent } from '../database/models/hcm-balance-event.model';

interface MockBalance {
  id: string;
  employeeId: string;
  locationId: string;
  balanceDays: number;
  version: number;
  lastModified: Date;
  update: jest.Mock;
}

function makeBalance(overrides: Partial<MockBalance> = {}): MockBalance {
  const base: MockBalance = {
    id: 'balance-id-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    balanceDays: 10,
    version: 1,
    lastModified: new Date(),
    update: jest.fn(),
    ...overrides,
  };
  // update() mutates the instance in-place, matching Sequelize instance behaviour
  base.update = jest.fn().mockImplementation(function (
    this: MockBalance,
    values: Partial<MockBalance>,
  ) {
    Object.assign(this, values);
    return Promise.resolve(this);
  });
  return base;
}

describe('SimulateService', () => {
  let service: SimulateService;

  const mockBalanceModel = {
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  const mockEventModel = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulateService,
        { provide: getModelToken(HcmBalance), useValue: mockBalanceModel },
        { provide: getModelToken(HcmBalanceEvent), useValue: mockEventModel },
      ],
    }).compile();

    service = module.get<SimulateService>(SimulateService);
    jest.clearAllMocks();
  });

  // ─── anniversaryBonus ────────────────────────────────────────────────────────

  describe('anniversaryBonus', () => {
    it('credits bonus days and returns the updated balance', async () => {
      const balance = makeBalance({ balanceDays: 10, version: 1 });
      mockBalanceModel.findOne.mockResolvedValue(balance);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.anniversaryBonus('emp-1', 'loc-1', 5);

      expect(result).toMatchObject({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        balanceDays: 15,
      });
    });

    it('increments version on the balance record', async () => {
      const balance = makeBalance({ balanceDays: 10, version: 1 });
      mockBalanceModel.findOne.mockResolvedValue(balance);
      mockEventModel.create.mockResolvedValue({});

      await service.anniversaryBonus('emp-1', 'loc-1', 5);

      expect(balance.update).toHaveBeenCalledWith(
        expect.objectContaining({ balanceDays: 15, version: 2 }),
      );
    });

    it('creates an ANNIVERSARY event triggered by ADMIN', async () => {
      const balance = makeBalance({ balanceDays: 10, version: 1 });
      mockBalanceModel.findOne.mockResolvedValue(balance);
      mockEventModel.create.mockResolvedValue({});

      await service.anniversaryBonus('emp-1', 'loc-1', 5);

      expect(mockEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          eventType: 'ANNIVERSARY',
          deltaDays: 5,
          triggeredBy: 'ADMIN',
        }),
      );
    });

    it('returns null when the balance record does not exist', async () => {
      mockBalanceModel.findOne.mockResolvedValue(null);

      const result = await service.anniversaryBonus('emp-x', 'loc-x', 5);

      expect(result).toBeNull();
      expect(mockEventModel.create).not.toHaveBeenCalled();
    });

    it('handles zero bonus days without error', async () => {
      const balance = makeBalance({ balanceDays: 10, version: 1 });
      mockBalanceModel.findOne.mockResolvedValue(balance);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.anniversaryBonus('emp-1', 'loc-1', 0);

      expect(result).toMatchObject({ balanceDays: 10 });
    });

    it('queries findOne by employeeId and locationId', async () => {
      mockBalanceModel.findOne.mockResolvedValue(null);

      await service.anniversaryBonus('emp-2', 'loc-3', 5);

      expect(mockBalanceModel.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'emp-2', locationId: 'loc-3' },
      });
    });

    it('reflects updated version in return value after update', async () => {
      const balance = makeBalance({ balanceDays: 10, version: 4 });
      mockBalanceModel.findOne.mockResolvedValue(balance);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.anniversaryBonus('emp-1', 'loc-1', 3);

      // balance.version is 5 after update() mutates the instance
      expect(result?.version).toBe(5);
    });
  });

  // ─── yearReset ───────────────────────────────────────────────────────────────

  describe('yearReset', () => {
    it('resets all balances to the specified value', async () => {
      const b1 = makeBalance({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10, version: 1 });
      const b2 = makeBalance({ id: 'b2', employeeId: 'emp-2', locationId: 'loc-2', balanceDays: 15, version: 2 });
      mockBalanceModel.findAll.mockResolvedValue([b1, b2]);
      mockEventModel.create.mockResolvedValue({});

      await service.yearReset(20);

      expect(b1.update).toHaveBeenCalledWith(
        expect.objectContaining({ balanceDays: 20, version: 2 }),
      );
      expect(b2.update).toHaveBeenCalledWith(
        expect.objectContaining({ balanceDays: 20, version: 3 }),
      );
    });

    it('returns { updated: N, resetValue } where N is total balance count', async () => {
      const balances = [
        makeBalance({ balanceDays: 10, version: 1 }),
        makeBalance({ id: 'b2', balanceDays: 5, version: 1 }),
        makeBalance({ id: 'b3', balanceDays: 8, version: 1 }),
      ];
      mockBalanceModel.findAll.mockResolvedValue(balances);
      mockEventModel.create.mockResolvedValue({});

      const result = await service.yearReset(15);

      expect(result).toEqual({ updated: 3, resetValue: 15 });
    });

    it('creates a YEAR_RESET event for every balance record', async () => {
      const b1 = makeBalance({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10, version: 1 });
      const b2 = makeBalance({ id: 'b2', employeeId: 'emp-2', locationId: 'loc-2', balanceDays: 5, version: 1 });
      mockBalanceModel.findAll.mockResolvedValue([b1, b2]);
      mockEventModel.create.mockResolvedValue({});

      await service.yearReset(15);

      expect(mockEventModel.create).toHaveBeenCalledTimes(2);
    });

    it('YEAR_RESET events carry correct deltaDays (positive when accrual increases)', async () => {
      const b = makeBalance({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5, version: 1 });
      mockBalanceModel.findAll.mockResolvedValue([b]);
      mockEventModel.create.mockResolvedValue({});

      await service.yearReset(15);

      expect(mockEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          eventType: 'YEAR_RESET',
          deltaDays: 10, // 15 - 5
          triggeredBy: 'SCHEDULER',
        }),
      );
    });

    it('YEAR_RESET events carry negative deltaDays when reset value is lower than current', async () => {
      const b = makeBalance({ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 20, version: 1 });
      mockBalanceModel.findAll.mockResolvedValue([b]);
      mockEventModel.create.mockResolvedValue({});

      await service.yearReset(10);

      expect(mockEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ deltaDays: -10 }),
      );
    });

    it('returns { updated: 0 } and creates no events when there are no balances', async () => {
      mockBalanceModel.findAll.mockResolvedValue([]);

      const result = await service.yearReset(10);

      expect(result).toEqual({ updated: 0, resetValue: 10 });
      expect(mockEventModel.create).not.toHaveBeenCalled();
    });

    it('can reset all balances to zero', async () => {
      const b = makeBalance({ balanceDays: 10, version: 1 });
      mockBalanceModel.findAll.mockResolvedValue([b]);
      mockEventModel.create.mockResolvedValue({});

      await service.yearReset(0);

      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({ balanceDays: 0 }),
      );
    });
  });
});
