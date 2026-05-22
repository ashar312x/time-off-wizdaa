import { Test, TestingModule } from '@nestjs/testing';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';

const mockRequest = {
  id: 'req-1',
  status: 'PENDING',
  requestedDays: 5,
  createdAt: new Date(),
};

describe('TimeOffController', () => {
  let controller: TimeOffController;
  let timeOffService: jest.Mocked<
    Pick<TimeOffService, 'listPending' | 'listOwn' | 'submit' | 'getById' | 'cancel' | 'approve' | 'reject'>
  >;

  beforeEach(async () => {
    timeOffService = {
      listPending: jest.fn().mockResolvedValue([mockRequest]),
      listOwn: jest.fn().mockResolvedValue({ data: [mockRequest], meta: { total: 1, page: 1, limit: 20 } }),
      submit: jest.fn().mockResolvedValue(mockRequest),
      getById: jest.fn().mockResolvedValue(mockRequest),
      cancel: jest.fn().mockResolvedValue(mockRequest),
      approve: jest.fn().mockResolvedValue(mockRequest),
      reject: jest.fn().mockResolvedValue(mockRequest),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeOffController],
      providers: [{ provide: TimeOffService, useValue: timeOffService }],
    }).compile();

    controller = module.get(TimeOffController);
  });

  describe('listPending', () => {
    it('returns all pending requests', async () => {
      const result = await controller.listPending();

      expect(timeOffService.listPending).toHaveBeenCalled();
      expect(result).toEqual([mockRequest]);
    });
  });

  describe('listOwn', () => {
    it('returns paginated own requests with default page and limit', async () => {
      const req = { user: { id: 'emp-1' } };

      const result = await controller.listOwn(req, '1', '20');

      expect(timeOffService.listOwn).toHaveBeenCalledWith('emp-1', 1, 20);
      expect(result).toMatchObject({ data: [mockRequest] });
    });

    it('parses page and limit query params as integers', async () => {
      const req = { user: { id: 'emp-1' } };

      await controller.listOwn(req, '2', '10');

      expect(timeOffService.listOwn).toHaveBeenCalledWith('emp-1', 2, 10);
    });
  });

  describe('submit', () => {
    it('delegates to timeOffService.submit with the authenticated user id', async () => {
      const req = { user: { id: 'emp-1' } };
      const dto = {
        locationId: 'loc-1',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        requestedDays: 5,
      };

      const result = await controller.submit(req, dto);

      expect(timeOffService.submit).toHaveBeenCalledWith('emp-1', dto);
      expect(result).toEqual(mockRequest);
    });
  });

  describe('getOne', () => {
    it('returns the request by id for the authenticated user', async () => {
      const req = { user: { id: 'emp-1', role: 'EMPLOYEE' } };

      const result = await controller.getOne('req-1', req);

      expect(timeOffService.getById).toHaveBeenCalledWith('req-1', 'emp-1', 'EMPLOYEE');
      expect(result).toEqual(mockRequest);
    });
  });

  describe('cancel', () => {
    it('delegates to timeOffService.cancel with the request id and user id', async () => {
      const req = { user: { id: 'emp-1' } };

      const result = await controller.cancel('req-1', req);

      expect(timeOffService.cancel).toHaveBeenCalledWith('req-1', 'emp-1');
      expect(result).toEqual(mockRequest);
    });
  });

  describe('approve', () => {
    it('delegates to timeOffService.approve with the request id and reviewer id', async () => {
      const req = { user: { id: 'manager-1' } };

      const result = await controller.approve('req-1', req);

      expect(timeOffService.approve).toHaveBeenCalledWith('req-1', 'manager-1');
      expect(result).toEqual(mockRequest);
    });
  });

  describe('reject', () => {
    it('delegates to timeOffService.reject with the request id, reviewer id, and optional reason', async () => {
      const req = { user: { id: 'manager-1' } };
      const dto = { reason: 'Not approved' };

      const result = await controller.reject('req-1', req, dto);

      expect(timeOffService.reject).toHaveBeenCalledWith('req-1', 'manager-1', 'Not approved');
      expect(result).toEqual(mockRequest);
    });

    it('passes undefined reason when not provided', async () => {
      const req = { user: { id: 'manager-1' } };

      await controller.reject('req-1', req, {});

      expect(timeOffService.reject).toHaveBeenCalledWith('req-1', 'manager-1', undefined);
    });
  });
});
