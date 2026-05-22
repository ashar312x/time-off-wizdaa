import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { TimeOffService } from './time-off.service';
import { TimeOffRequest } from '../database/models/time-off-request.model';
import { Balance } from '../database/models/balance.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { BalanceService } from '../balance/balance.service';
import { HcmClientService } from '../hcm-client/hcm-client.service';

const now = new Date();
const mockEmployee = { id: 'emp-uuid-1', fullName: 'Alice', hcmEmployeeId: 'hcm-emp-1' };
const mockLocation = { id: 'loc-uuid-1', name: 'New York HQ', hcmLocationId: 'hcm-loc-1' };

function makeBalance(cachedBalanceDays = 15) {
  return {
    id: 'bal-uuid-1',
    employeeId: 'emp-uuid-1',
    locationId: 'loc-uuid-1',
    cachedBalanceDays,
    hcmVersion: 1,
    updatedAt: now,
    update: jest.fn().mockResolvedValue(undefined),
    findByPk: jest.fn(),
  };
}

function makeRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'req-uuid-1',
    employeeId: 'emp-uuid-1',
    locationId: 'loc-uuid-1',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    requestedDays: 5,
    status: 'PENDING',
    reason: null,
    hcmDeductionRef: 'req-uuid-1',
    createdAt: now,
    update: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

describe('TimeOffService', () => {
  let service: TimeOffService;
  let requestModel: Record<string, jest.Mock>;
  let balanceModel: Record<string, jest.Mock>;
  let employeeModel: Record<string, jest.Mock>;
  let locationModel: Record<string, jest.Mock>;
  let balanceService: jest.Mocked<Pick<BalanceService, 'decrementLocal' | 'creditLocal' | 'updateFromHcm'>>;
  let hcmClient: jest.Mocked<Pick<HcmClientService, 'getBalance' | 'deduct' | 'credit'>>;

  beforeEach(async () => {
    requestModel = {
      findAndCountAll: jest.fn(),
      findByPk: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    };
    balanceModel = { findOne: jest.fn(), findByPk: jest.fn() };
    employeeModel = { findByPk: jest.fn() };
    locationModel = { findByPk: jest.fn() };
    balanceService = {
      decrementLocal: jest.fn().mockResolvedValue(true),
      creditLocal: jest.fn().mockResolvedValue(undefined),
      updateFromHcm: jest.fn().mockResolvedValue(undefined),
    };
    hcmClient = {
      getBalance: jest.fn(),
      deduct: jest.fn(),
      credit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        { provide: getModelToken(TimeOffRequest), useValue: requestModel },
        { provide: getModelToken(Balance), useValue: balanceModel },
        { provide: getModelToken(Employee), useValue: employeeModel },
        { provide: getModelToken(Location), useValue: locationModel },
        { provide: BalanceService, useValue: balanceService },
        { provide: HcmClientService, useValue: hcmClient },
        {
          provide: Sequelize,
          useValue: {
            transaction: jest.fn().mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
              fn({}),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(TimeOffService);
  });

  describe('listOwn', () => {
    it('returns paginated time-off requests for the employee', async () => {
      const rows = [makeRequest()];
      requestModel.findAndCountAll.mockResolvedValue({ rows, count: 1 });

      const result = await service.listOwn('emp-uuid-1', 1, 20);

      expect(result.data).toEqual(rows);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('calculates the correct offset for page 2', async () => {
      requestModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      await service.listOwn('emp-uuid-1', 2, 10);

      expect(requestModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 10, limit: 10 }),
      );
    });
  });

  describe('getById', () => {
    it('returns the request when the employee is the owner', async () => {
      const request = makeRequest();
      requestModel.findByPk.mockResolvedValue(request);

      const result = await service.getById('req-uuid-1', 'emp-uuid-1', 'EMPLOYEE');

      expect(result).toEqual(request);
    });

    it('returns any request for a MANAGER regardless of ownership', async () => {
      const request = makeRequest({ employeeId: 'emp-uuid-2' });
      requestModel.findByPk.mockResolvedValue(request);

      const result = await service.getById('req-uuid-1', 'manager-uuid', 'MANAGER');

      expect(result).toEqual(request);
    });

    it('throws NotFoundException when the request does not exist', async () => {
      requestModel.findByPk.mockResolvedValue(null);

      await expect(service.getById('bad-id', 'emp-uuid-1', 'EMPLOYEE')).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when an EMPLOYEE accesses another employee's request", async () => {
      requestModel.findByPk.mockResolvedValue(makeRequest({ employeeId: 'emp-uuid-2' }));

      await expect(service.getById('req-uuid-1', 'emp-uuid-1', 'EMPLOYEE')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listPending', () => {
    it('returns all pending requests ordered by creation date', async () => {
      const pending = [makeRequest()];
      requestModel.findAll.mockResolvedValue(pending);

      const result = await service.listPending();

      expect(requestModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } }),
      );
      expect(result).toEqual(pending);
    });
  });

  describe('submit', () => {
    const validDto = {
      locationId: 'loc-uuid-1',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      requestedDays: 5,
    };

    beforeEach(() => {
      employeeModel.findByPk.mockResolvedValue(mockEmployee);
      locationModel.findByPk.mockResolvedValue(mockLocation);
      hcmClient.getBalance.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 15, version: 1 });
      hcmClient.deduct.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 10, version: 2 });
      requestModel.create.mockImplementation((data: Record<string, unknown>) => ({
        id: data.id,
        status: data.status,
        requestedDays: data.requestedDays,
        createdAt: now,
      }));
      // submit() calls findOne twice: (1) local balance check, (2) fetch refreshed balance post-deduction
      balanceModel.findOne
        .mockResolvedValueOnce(makeBalance(15))
        .mockResolvedValueOnce({ cachedBalanceDays: 10 });
    });

    it('creates a time-off request and returns the result with balanceAfterRequest', async () => {
      const result = await service.submit('emp-uuid-1', validDto);

      expect(result).toMatchObject({ status: 'PENDING', requestedDays: 5 });
      expect(hcmClient.deduct).toHaveBeenCalled();
      expect(balanceService.decrementLocal).toHaveBeenCalled();
    });

    it('throws BadRequestException when endDate is before startDate', async () => {
      const dto = { ...validDto, startDate: '2026-06-10', endDate: '2026-06-01' };

      await expect(service.submit('emp-uuid-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException when the location is not found', async () => {
      locationModel.findByPk.mockResolvedValue(null);

      await expect(service.submit('emp-uuid-1', validDto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when the employee has no balance record for the location', async () => {
      locationModel.findByPk.mockResolvedValue(mockLocation);
      balanceModel.findOne.mockReset();
      balanceModel.findOne.mockResolvedValue(null);

      await expect(service.submit('emp-uuid-1', validDto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException (INSUFFICIENT_BALANCE) when local cache is too low', async () => {
      balanceModel.findOne.mockReset();
      balanceModel.findOne.mockResolvedValue(makeBalance(2)); // only 2 days available

      await expect(service.submit('emp-uuid-1', { ...validDto, requestedDays: 5 })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException (INSUFFICIENT_BALANCE) when HCM balance is too low', async () => {
      hcmClient.getBalance.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 2, version: 1 }); // HCM says only 2

      await expect(service.submit('emp-uuid-1', { ...validDto, requestedDays: 5 })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws ConflictException when both optimistic lock attempts fail', async () => {
      balanceService.decrementLocal.mockResolvedValue(false); // both attempts fail
      balanceModel.findByPk.mockResolvedValue(makeBalance(15));

      await expect(service.submit('emp-uuid-1', validDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('cancels a PENDING request and credits the balance back', async () => {
      const request = makeRequest();
      requestModel.findByPk.mockResolvedValue(request);
      employeeModel.findByPk.mockResolvedValue(mockEmployee);
      locationModel.findByPk.mockResolvedValue(mockLocation);
      hcmClient.credit.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 20, version: 3 });

      const result = await service.cancel('req-uuid-1', 'emp-uuid-1');

      expect(request.update).toHaveBeenCalledWith({ status: 'CANCELLED' });
      expect(balanceService.creditLocal).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when the request does not exist', async () => {
      requestModel.findByPk.mockResolvedValue(null);

      await expect(service.cancel('bad-id', 'emp-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not the owner', async () => {
      requestModel.findByPk.mockResolvedValue(makeRequest({ employeeId: 'emp-uuid-2' }));

      await expect(service.cancel('req-uuid-1', 'emp-uuid-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws UnprocessableEntityException when the request is not PENDING', async () => {
      requestModel.findByPk.mockResolvedValue(makeRequest({ status: 'APPROVED' }));

      await expect(service.cancel('req-uuid-1', 'emp-uuid-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('approve', () => {
    it('approves a PENDING request when HCM balance is non-negative', async () => {
      const request = makeRequest();
      requestModel.findByPk.mockResolvedValue(request);
      employeeModel.findByPk.mockResolvedValue(mockEmployee);
      locationModel.findByPk.mockResolvedValue(mockLocation);
      hcmClient.getBalance.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 5, version: 2 });

      const result = await service.approve('req-uuid-1', 'manager-uuid');

      expect(request.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED', reviewedBy: 'manager-uuid' }),
      );
      expect(result).toBe(request);
    });

    it('throws NotFoundException when the request does not exist', async () => {
      requestModel.findByPk.mockResolvedValue(null);

      await expect(service.approve('bad-id', 'manager-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when the request is not PENDING', async () => {
      requestModel.findByPk.mockResolvedValue(makeRequest({ status: 'REJECTED' }));

      await expect(service.approve('req-uuid-1', 'manager-uuid')).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when HCM balance is negative', async () => {
      requestModel.findByPk.mockResolvedValue(makeRequest());
      employeeModel.findByPk.mockResolvedValue(mockEmployee);
      locationModel.findByPk.mockResolvedValue(mockLocation);
      hcmClient.getBalance.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: -1, version: 2 });

      await expect(service.approve('req-uuid-1', 'manager-uuid')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('reject', () => {
    it('rejects a PENDING request and credits the balance back', async () => {
      const request = makeRequest();
      requestModel.findByPk.mockResolvedValue(request);
      employeeModel.findByPk.mockResolvedValue(mockEmployee);
      locationModel.findByPk.mockResolvedValue(mockLocation);
      hcmClient.credit.mockResolvedValue({ employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 20, version: 3 });

      await service.reject('req-uuid-1', 'manager-uuid', 'Not approved');

      expect(request.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REJECTED', reviewedBy: 'manager-uuid' }),
      );
      expect(balanceService.creditLocal).toHaveBeenCalledWith(
        'emp-uuid-1',
        'loc-uuid-1',
        5,
        'req-uuid-1',
        'REJECTION_CREDIT',
        'MANAGER',
      );
    });

    it('throws NotFoundException when the request does not exist', async () => {
      requestModel.findByPk.mockResolvedValue(null);

      await expect(service.reject('bad-id', 'manager-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when the request is not PENDING', async () => {
      requestModel.findByPk.mockResolvedValue(makeRequest({ status: 'CANCELLED' }));

      await expect(service.reject('req-uuid-1', 'manager-uuid')).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
