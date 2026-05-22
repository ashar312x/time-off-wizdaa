import {
  Injectable,
  UnprocessableEntityException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { HcmBalance } from '../database/models/hcm-balance.model';
import { HcmBalanceEvent } from '../database/models/hcm-balance-event.model';
import { HcmDeductionRef } from '../database/models/hcm-deduction-ref.model';

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BalanceService {
  constructor(
    @InjectModel(HcmBalance) private balanceModel: typeof HcmBalance,
    @InjectModel(HcmBalanceEvent) private eventModel: typeof HcmBalanceEvent,
    @InjectModel(HcmDeductionRef) private refModel: typeof HcmDeductionRef,
  ) {}

  async getBalance(employeeId: string, locationId: string) {
    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) {
      throw new UnprocessableEntityException({
        error: 'INVALID_COMBINATION',
        message: 'Invalid employee/location combination',
      });
    }
    return {
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      balanceDays: balance.balanceDays,
      version: balance.version,
    };
  }

  async deduct(
    employeeId: string,
    locationId: string,
    days: number,
    referenceId?: string,
  ) {
    if (referenceId) {
      const existing = await this.refModel.findOne({
        where: {
          referenceId,
          operation: 'DEDUCT',
          createdAt: {
            [Op.gte]: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS),
          },
        },
      });
      if (existing) {
        return {
          employeeId: existing.employeeId,
          locationId: existing.locationId,
          balanceDays: existing.balanceAfter,
          version: existing.versionAfter,
        };
      }
    }

    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) {
      throw new UnprocessableEntityException({
        error: 'INVALID_COMBINATION',
        message: 'Invalid employee/location combination',
      });
    }

    if (balance.balanceDays < days) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance. Available: ${balance.balanceDays}`,
        availableDays: balance.balanceDays,
      });
    }

    const newBalance = balance.balanceDays - days;
    const newVersion = balance.version + 1;
    const [updated] = await this.balanceModel.update(
      {
        balanceDays: newBalance,
        version: newVersion,
        lastModified: new Date(),
      },
      { where: { id: balance.id, version: balance.version } },
    );

    if (!updated) {
      throw new ConflictException({
        error: 'VERSION_CONFLICT',
        message: 'Concurrent modification detected',
      });
    }

    await this.eventModel.create({
      employeeId,
      locationId,
      eventType: 'DEDUCTION',
      deltaDays: -days,
      triggeredBy: 'EXAMPLEHR',
    });

    if (referenceId) {
      await this.refModel.create({
        referenceId,
        employeeId,
        locationId,
        days,
        operation: 'DEDUCT',
        balanceAfter: newBalance,
        versionAfter: newVersion,
      });
    }

    return {
      employeeId,
      locationId,
      balanceDays: newBalance,
      version: newVersion,
    };
  }

  async credit(
    employeeId: string,
    locationId: string,
    days: number,
    referenceId?: string,
  ) {
    if (referenceId) {
      const existing = await this.refModel.findOne({
        where: {
          referenceId,
          operation: 'CREDIT',
          createdAt: {
            [Op.gte]: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS),
          },
        },
      });
      if (existing) {
        return {
          employeeId: existing.employeeId,
          locationId: existing.locationId,
          balanceDays: existing.balanceAfter,
          version: existing.versionAfter,
        };
      }
    }

    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) {
      throw new UnprocessableEntityException({
        error: 'INVALID_COMBINATION',
        message: 'Invalid employee/location combination',
      });
    }

    const newBalance = balance.balanceDays + days;
    const newVersion = balance.version + 1;
    await this.balanceModel.update(
      {
        balanceDays: newBalance,
        version: newVersion,
        lastModified: new Date(),
      },
      { where: { id: balance.id } },
    );

    await this.eventModel.create({
      employeeId,
      locationId,
      eventType: 'CREDIT',
      deltaDays: days,
      triggeredBy: 'EXAMPLEHR',
    });

    if (referenceId) {
      await this.refModel.create({
        referenceId,
        employeeId,
        locationId,
        days,
        operation: 'CREDIT',
        balanceAfter: newBalance,
        versionAfter: newVersion,
      });
    }

    return {
      employeeId,
      locationId,
      balanceDays: newBalance,
      version: newVersion,
    };
  }

  async getBatch(page = 1, limit = 500) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.balanceModel.findAndCountAll({
      limit,
      offset,
      order: [['employeeId', 'ASC']],
    });
    return {
      data: rows.map((b) => ({
        employeeId: b.employeeId,
        locationId: b.locationId,
        balanceDays: b.balanceDays,
        version: b.version,
      })),
      meta: { total: count, page, limit },
    };
  }
}
