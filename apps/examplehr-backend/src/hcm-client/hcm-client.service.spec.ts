import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { HcmClientService } from './hcm-client.service';

function makeAxiosError(status: number, body: Record<string, unknown> = {}): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = {
    status,
    data: body,
    statusText: 'Error',
    headers: {} as never,
    config: { headers: {} as never, url: '' },
  };
  return err;
}

const hcmBalanceData = { employeeId: 'hcm-emp-1', locationId: 'hcm-loc-1', balanceDays: 10, version: 1 };

describe('HcmClientService', () => {
  let service: HcmClientService;
  let httpService: { get: jest.Mock; patch: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn(), patch: jest.fn() };

    // Suppress retry delays in all tests by replacing setTimeout
    jest.spyOn(global, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmClientService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, d: string) => {
              if (key === 'HCM_BASE_URL') return 'http://hcm-test';
              if (key === 'HCM_API_KEY') return 'test-key';
              return d;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(HcmClientService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBalance', () => {
    it('returns the balance DTO from HCM on success', async () => {
      httpService.get.mockReturnValue(of({ data: { data: hcmBalanceData } }));

      const result = await service.getBalance('hcm-emp-1', 'hcm-loc-1');

      expect(result).toEqual(hcmBalanceData);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://hcm-test/balances/hcm-emp-1/hcm-loc-1',
        expect.objectContaining({ headers: { 'x-api-key': 'test-key' } }),
      );
    });

    it('retries on 5xx errors and eventually throws ServiceUnavailableException', async () => {
      const serverError = makeAxiosError(500);
      httpService.get.mockReturnValue(throwError(() => serverError));

      await expect(service.getBalance('hcm-emp-1', 'hcm-loc-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(httpService.get).toHaveBeenCalledTimes(3);
    });

    it('does not retry on 4xx errors', async () => {
      const clientError = makeAxiosError(404);
      httpService.get.mockReturnValue(throwError(() => clientError));

      await expect(service.getBalance('hcm-emp-1', 'hcm-loc-1')).rejects.toThrow(AxiosError);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('deduct', () => {
    it('returns updated balance DTO after a successful deduction', async () => {
      httpService.patch.mockReturnValue(of({ data: { data: { ...hcmBalanceData, balanceDays: 5 } } }));

      const result = await service.deduct('hcm-emp-1', 'hcm-loc-1', 5, 'ref-1');

      expect(result.balanceDays).toBe(5);
      expect(httpService.patch).toHaveBeenCalledWith(
        'http://hcm-test/balances/hcm-emp-1/hcm-loc-1/deduct',
        { days: 5, referenceId: 'ref-1' },
        expect.any(Object),
      );
    });

    it('maps INSUFFICIENT_BALANCE HCM error to UnprocessableEntityException', async () => {
      const err = makeAxiosError(422, { error: 'INSUFFICIENT_BALANCE', message: 'Not enough days', availableDays: 2 });
      httpService.patch.mockReturnValue(throwError(() => err));

      await expect(service.deduct('hcm-emp-1', 'hcm-loc-1', 10, 'ref-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('maps VERSION_CONFLICT HCM error to ConflictException', async () => {
      const err = makeAxiosError(409, { error: 'VERSION_CONFLICT' });
      httpService.patch.mockReturnValue(throwError(() => err));

      await expect(service.deduct('hcm-emp-1', 'hcm-loc-1', 5, 'ref-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('credit', () => {
    it('returns updated balance DTO after a successful credit', async () => {
      httpService.patch.mockReturnValue(of({ data: { data: { ...hcmBalanceData, balanceDays: 15 } } }));

      const result = await service.credit('hcm-emp-1', 'hcm-loc-1', 5, 'ref-1');

      expect(result.balanceDays).toBe(15);
      expect(httpService.patch).toHaveBeenCalledWith(
        'http://hcm-test/balances/hcm-emp-1/hcm-loc-1/credit',
        { days: 5, referenceId: 'ref-1' },
        expect.any(Object),
      );
    });

    it('retries on 5xx errors and throws ServiceUnavailableException after max retries', async () => {
      const serverError = makeAxiosError(503);
      httpService.patch.mockReturnValue(throwError(() => serverError));

      await expect(service.credit('hcm-emp-1', 'hcm-loc-1', 5, 'ref-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(httpService.patch).toHaveBeenCalledTimes(3);
    });
  });

  describe('getBatch', () => {
    it('returns the batch response from HCM', async () => {
      const batchData = { data: [hcmBalanceData], meta: { total: 1 } };
      httpService.get.mockReturnValue(of({ data: batchData }));

      const result = await service.getBatch(1, 500);

      expect(result).toEqual(batchData);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://hcm-test/balances/batch',
        expect.objectContaining({ params: { page: 1, limit: 500 } }),
      );
    });
  });

  describe('healthCheck', () => {
    it('returns true when the HCM batch endpoint responds successfully', async () => {
      httpService.get.mockReturnValue(of({ data: {} }));

      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('returns false when the HCM endpoint throws any error', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });
});
