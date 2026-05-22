import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { HcmBalance } from '../database/models/hcm-balance.model';
import { HcmBalanceEvent } from '../database/models/hcm-balance-event.model';

@Injectable()
export class SimulateService {
  constructor(
    @InjectModel(HcmBalance) private balanceModel: typeof HcmBalance,
    @InjectModel(HcmBalanceEvent) private eventModel: typeof HcmBalanceEvent,
  ) {}

  async anniversaryBonus(
    employeeId: string,
    locationId: string,
    bonusDays: number,
  ) {
    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) return null;
    const newBalance = balance.balanceDays + bonusDays;
    await balance.update({
      balanceDays: newBalance,
      version: balance.version + 1,
      lastModified: new Date(),
    });
    await this.eventModel.create({
      employeeId,
      locationId,
      eventType: 'ANNIVERSARY',
      deltaDays: bonusDays,
      triggeredBy: 'ADMIN',
    });
    return {
      employeeId,
      locationId,
      balanceDays: newBalance,
      version: balance.version,
    };
  }

  async yearReset(resetValue: number) {
    const balances = await this.balanceModel.findAll();
    for (const b of balances) {
      await b.update({
        balanceDays: resetValue,
        version: b.version + 1,
        lastModified: new Date(),
      });
      await this.eventModel.create({
        employeeId: b.employeeId,
        locationId: b.locationId,
        eventType: 'YEAR_RESET',
        deltaDays: resetValue - b.balanceDays,
        triggeredBy: 'SCHEDULER',
      });
    }
    return { updated: balances.length, resetValue };
  }
}
