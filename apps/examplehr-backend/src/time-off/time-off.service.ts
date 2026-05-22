import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { TimeOffRequest } from '../database/models/time-off-request.model';
import { Balance } from '../database/models/balance.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { BalanceService } from '../balance/balance.service';
import { HcmClientService } from '../hcm-client/hcm-client.service';

@Injectable()
export class TimeOffService {
  constructor(
    @InjectModel(TimeOffRequest) private requestModel: typeof TimeOffRequest,
    @InjectModel(Balance) private balanceModel: typeof Balance,
    @InjectModel(Employee) private employeeModel: typeof Employee,
    @InjectModel(Location) private locationModel: typeof Location,
    private balanceService: BalanceService,
    private hcmClient: HcmClientService,
    @InjectConnection() private sequelize: Sequelize,
  ) {}

  async listOwn(employeeId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.requestModel.findAndCountAll({
      where: { employeeId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    return { data: rows, meta: { total: count, page, limit } };
  }

  async getById(id: string, userId: string, role: string) {
    const request = await this.requestModel.findByPk(id);
    if (!request) {
      throw new NotFoundException({ error: 'REQUEST_NOT_FOUND' });
    }
    if (role === 'EMPLOYEE' && request.employeeId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }
    return request;
  }

  async listPending() {
    return this.requestModel.findAll({
      where: { status: 'PENDING' },
      order: [['createdAt', 'ASC']],
      include: [{ model: Employee, attributes: ['id', 'fullName', 'email'] }],
    });
  }

  async submit(
    employeeId: string,
    dto: {
      locationId: string;
      startDate: string;
      endDate: string;
      requestedDays: number;
      reason?: string;
    },
  ) {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException({
        error: 'INVALID_DATE_RANGE',
        message: 'endDate must be on or after startDate',
      });
    }

    const employee = await this.employeeModel.findByPk(employeeId);
    const location = await this.locationModel.findByPk(dto.locationId);
    if (!location) {
      throw new UnprocessableEntityException({
        error: 'INVALID_LOCATION',
        message: 'Invalid location',
      });
    }

    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId: dto.locationId },
    });
    if (!balance) {
      throw new UnprocessableEntityException({
        error: 'INVALID_LOCATION',
        message: 'Employee not enrolled in location',
      });
    }

    if (balance.cachedBalanceDays < dto.requestedDays) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        message: `Requested ${dto.requestedDays} days but only ${balance.cachedBalanceDays} days available.`,
        availableDays: balance.cachedBalanceDays,
      });
    }

    const hcmBalance = await this.hcmClient.getBalance(
      employee!.hcmEmployeeId,
      location.hcmLocationId,
    );

    if (hcmBalance.balanceDays < dto.requestedDays) {
      await this.balanceService.updateFromHcm(
        employeeId,
        dto.locationId,
        hcmBalance.balanceDays,
        hcmBalance.version,
      );
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        message: `Requested ${dto.requestedDays} days but only ${hcmBalance.balanceDays} days available.`,
        availableDays: hcmBalance.balanceDays,
      });
    }

    const requestId = uuidv4();
    const hcmResult = await this.hcmClient.deduct(
      employee!.hcmEmployeeId,
      location.hcmLocationId,
      dto.requestedDays,
      requestId,
    );

    const snapshotUpdatedAt = balance.updatedAt;
    let updated = await this.balanceService.decrementLocal(
      employeeId,
      dto.locationId,
      dto.requestedDays,
      requestId,
      'EMPLOYEE',
      snapshotUpdatedAt,
    );

    if (!updated) {
      updated = await this.balanceService.decrementLocal(
        employeeId,
        dto.locationId,
        dto.requestedDays,
        requestId,
        'EMPLOYEE',
        (await this.balanceModel.findByPk(balance.id))!.updatedAt,
      );
      if (!updated) {
        throw new ConflictException({
          error: 'CONCURRENT_MODIFICATION',
          message: 'Balance was modified concurrently',
        });
      }
    }

    const request = await this.requestModel.create({
      id: requestId,
      employeeId,
      locationId: dto.locationId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      requestedDays: dto.requestedDays,
      status: 'PENDING',
      reason: dto.reason ?? null,
      hcmDeductionRef: requestId,
    });

    await this.balanceService.updateFromHcm(
      employeeId,
      dto.locationId,
      hcmResult.balanceDays,
      hcmResult.version,
    );

    const refreshed = await this.balanceModel.findOne({
      where: { employeeId, locationId: dto.locationId },
    });

    return {
      id: request.id,
      status: request.status,
      requestedDays: request.requestedDays,
      balanceAfterRequest: refreshed?.cachedBalanceDays ?? 0,
      createdAt: request.createdAt,
    };
  }

  async cancel(id: string, employeeId: string) {
    const request = await this.requestModel.findByPk(id);
    if (!request) {
      throw new NotFoundException({ error: 'REQUEST_NOT_FOUND' });
    }
    if (request.employeeId !== employeeId) {
      throw new ForbiddenException({ error: 'FORBIDDEN' });
    }
    if (request.status !== 'PENDING') {
      throw new UnprocessableEntityException({
        error: 'REQUEST_NOT_CANCELLABLE',
        message: 'Only PENDING requests can be cancelled',
      });
    }
    await this.creditBack(request, 'CANCELLED', 'CANCELLATION_CREDIT', 'EMPLOYEE');
    return request.reload();
  }

  async approve(id: string, reviewerId: string) {
    const request = await this.requestModel.findByPk(id);
    if (!request) {
      throw new NotFoundException({ error: 'REQUEST_NOT_FOUND' });
    }
    if (request.status !== 'PENDING') {
      throw new UnprocessableEntityException({
        error: 'REQUEST_NOT_CANCELLABLE',
        message: 'Request is not pending',
      });
    }

    const employee = await this.employeeModel.findByPk(request.employeeId);
    const location = await this.locationModel.findByPk(request.locationId);
    const hcmBalance = await this.hcmClient.getBalance(
      employee!.hcmEmployeeId,
      location!.hcmLocationId,
    );
    if (hcmBalance.balanceDays < 0) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        message: 'HCM balance insufficient for approval',
        availableDays: hcmBalance.balanceDays,
      });
    }

    await request.update({
      status: 'APPROVED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });

    return request;
  }

  async reject(id: string, reviewerId: string, reason?: string) {
    const request = await this.requestModel.findByPk(id);
    if (!request) {
      throw new NotFoundException({ error: 'REQUEST_NOT_FOUND' });
    }
    if (request.status !== 'PENDING') {
      throw new UnprocessableEntityException({
        error: 'REQUEST_NOT_CANCELLABLE',
        message: 'Request is not pending',
      });
    }
    await request.update({
      status: 'REJECTED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reason: reason ?? request.reason,
    });
    await this.creditBack(request, 'REJECTED', 'REJECTION_CREDIT', 'MANAGER');
    return request.reload();
  }

  private async creditBack(
    request: TimeOffRequest,
    status: 'CANCELLED' | 'REJECTED',
    eventType: string,
    source: string,
  ) {
    const employee = await this.employeeModel.findByPk(request.employeeId);
    const location = await this.locationModel.findByPk(request.locationId);
    await this.hcmClient.credit(
      employee!.hcmEmployeeId,
      location!.hcmLocationId,
      request.requestedDays,
      request.hcmDeductionRef || request.id,
    );
    await request.update({ status });
    await this.balanceService.creditLocal(
      request.employeeId,
      request.locationId,
      request.requestedDays,
      request.id,
      eventType,
      source,
    );
  }
}
