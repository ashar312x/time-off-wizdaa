import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
import { Balance } from '../database/models/balance.model';
import { BalanceAuditLog } from '../database/models/balance-audit-log.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { HcmClientService } from '../hcm-client/hcm-client.service';

@Injectable()
export class BalanceService {
  private readonly cacheTtlMs: number;

  constructor(
    @InjectModel(Balance) private balanceModel: typeof Balance,
    @InjectModel(BalanceAuditLog) private auditModel: typeof BalanceAuditLog,
    @InjectModel(Employee) private employeeModel: typeof Employee,
    @InjectModel(Location) private locationModel: typeof Location,
    private hcmClient: HcmClientService,
    private config: ConfigService,
    @InjectConnection() private sequelize: Sequelize,
  ) {
    const ttlMin = parseInt(config.get('BALANCE_CACHE_TTL_MINUTES', '5'), 10);
    this.cacheTtlMs = ttlMin * 60 * 1000;
  }

  private isCacheStale(balance: Balance): boolean {
    if (balance.isStale) return true;
    return Date.now() - new Date(balance.lastSyncedAt).getTime() >= this.cacheTtlMs;
  }

  async getBalancesForEmployee(employeeId: string) {
    const balances = await this.balanceModel.findAll({
      where: { employeeId },
    });
    const locations = await this.locationModel.findAll();
    const locMap = new Map(locations.map((l) => [l.id, l]));

    const result = [];
    for (const b of balances) {
      if (this.isCacheStale(b)) {
        this.refreshFromHcmAsync(b, employeeId).catch(() => {});
      }
      result.push({
        locationId: b.locationId,
        locationName: locMap.get(b.locationId)?.name,
        cachedBalanceDays: b.cachedBalanceDays,
        isStale: b.isStale || this.isCacheStale(b),
        lastSyncedAt: b.lastSyncedAt,
      });
    }
    return result;
  }

  private async refreshFromHcmAsync(balance: Balance, employeeId: string) {
    const employee = await this.employeeModel.findByPk(employeeId);
    const location = await this.locationModel.findByPk(balance.locationId);
    if (!employee || !location) return;
    const hcm = await this.hcmClient.getBalance(
      employee.hcmEmployeeId,
      location.hcmLocationId,
    );
    await balance.update({
      cachedBalanceDays: hcm.balanceDays,
      hcmVersion: hcm.version,
      lastSyncedAt: new Date(),
      isStale: false,
    });
  }

  async forceSync(employeeId: string, locationId: string) {
    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) return null;
    await this.refreshFromHcmAsync(balance, employeeId);
    return balance.reload();
  }

  async decrementLocal(
    employeeId: string,
    locationId: string,
    days: number,
    requestId: string,
    source: string,
    snapshotUpdatedAt: Date,
  ): Promise<boolean> {
    return this.sequelize.transaction(async (t) => {
      const balance = await this.balanceModel.findOne({
        where: { employeeId, locationId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!balance) return false;

      const [affected] = await this.balanceModel.update(
        {
          cachedBalanceDays: balance.cachedBalanceDays - days,
          updatedAt: new Date(),
        },
        {
          where: {
            id: balance.id,
            updatedAt: snapshotUpdatedAt,
          },
          transaction: t,
        },
      );

      if (!affected) return false;

      await this.auditModel.create(
        {
          employeeId,
          locationId,
          eventType: 'REQUEST_DEDUCTION',
          deltaDays: -days,
          balanceBefore: balance.cachedBalanceDays,
          balanceAfter: balance.cachedBalanceDays - days,
          requestId,
          source,
        },
        { transaction: t },
      );
      return true;
    });
  }

  async creditLocal(
    employeeId: string,
    locationId: string,
    days: number,
    requestId: string,
    eventType: string,
    source: string,
  ) {
    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) return;
    const before = balance.cachedBalanceDays;
    await balance.update({
      cachedBalanceDays: before + days,
      lastSyncedAt: new Date(),
    });
    await this.auditModel.create({
      employeeId,
      locationId,
      eventType,
      deltaDays: days,
      balanceBefore: before,
      balanceAfter: before + days,
      requestId,
      source,
    });
  }

  async updateFromHcm(
    employeeId: string,
    locationId: string,
    balanceDays: number,
    version: number,
  ) {
    const balance = await this.balanceModel.findOne({
      where: { employeeId, locationId },
    });
    if (!balance) return;
    await balance.update({
      cachedBalanceDays: balanceDays,
      hcmVersion: version,
      lastSyncedAt: new Date(),
      isStale: false,
    });
  }
}
