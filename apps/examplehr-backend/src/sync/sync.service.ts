import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Balance } from '../database/models/balance.model';
import { BalanceAuditLog } from '../database/models/balance-audit-log.model';
import { SyncRun } from '../database/models/sync-run.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { TimeOffRequest } from '../database/models/time-off-request.model';
import { HcmClientService } from '../hcm-client/hcm-client.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectModel(Balance) private balanceModel: typeof Balance,
    @InjectModel(SyncRun) private syncRunModel: typeof SyncRun,
    @InjectModel(Employee) private employeeModel: typeof Employee,
    @InjectModel(Location) private locationModel: typeof Location,
    @InjectModel(TimeOffRequest) private requestModel: typeof TimeOffRequest,
    @InjectModel(BalanceAuditLog) private auditModel: typeof BalanceAuditLog,
    private hcmClient: HcmClientService,
    private config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync() {
    const interval = parseInt(
      this.config.get('SYNC_INTERVAL_MINUTES', '60'),
      10,
    );
    if (interval !== 60) return;
    await this.runSync('SCHEDULER');
  }

  async runSync(triggeredBy: 'SCHEDULER' | 'MANUAL') {
    const run = await this.syncRunModel.create({
      triggeredBy,
      status: 'RUNNING',
      startedAt: new Date(),
    });

    let recordsUpdated = 0;
    let recordsFailed = 0;
    let page = 1;
    const limit = 500;

    try {
      const employees = await this.employeeModel.findAll();
      const locations = await this.locationModel.findAll();
      const empByHcm = new Map(employees.map((e) => [e.hcmEmployeeId, e]));
      const locByHcm = new Map(locations.map((l) => [l.hcmLocationId, l]));

      while (true) {
        const batch = await this.hcmClient.getBatch(page, limit);
        const items = batch.data as Array<{
          employeeId: string;
          locationId: string;
          balanceDays: number;
          version: number;
        }>;

        for (const item of items) {
          try {
            const emp = empByHcm.get(item.employeeId);
            const loc = locByHcm.get(item.locationId);
            if (!emp || !loc) continue;

            const existing = await this.balanceModel.findOne({
              where: { employeeId: emp.id, locationId: loc.id },
            });

            if (existing) {
              if (existing.hcmVersion !== item.version) {
                await existing.update({
                  cachedBalanceDays: item.balanceDays,
                  hcmVersion: item.version,
                  lastSyncedAt: new Date(),
                  isStale: false,
                });
                recordsUpdated++;
              } else {
                await existing.update({ lastSyncedAt: new Date(), isStale: false });
              }
            } else {
              await this.balanceModel.create({
                employeeId: emp.id,
                locationId: loc.id,
                cachedBalanceDays: item.balanceDays,
                hcmVersion: item.version,
                lastSyncedAt: new Date(),
                isStale: false,
              });
              recordsUpdated++;
            }
          } catch {
            recordsFailed++;
          }
        }

        const total = batch.meta?.total ?? items.length;
        if (page * limit >= total || items.length < limit) break;
        page++;
      }

      await this.detectDrift();

      await run.update({
        status: 'COMPLETED',
        recordsUpdated,
        recordsFailed,
        completedAt: new Date(),
      });

      return run.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      this.logger.error(message);
      await run.update({
        status: 'FAILED',
        recordsUpdated,
        recordsFailed,
        errorMessage: message,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  private async detectDrift() {
    const approved = await this.requestModel.findAll({
      where: { status: 'APPROVED' },
    });
    for (const req of approved) {
      const balance = await this.balanceModel.findOne({
        where: { employeeId: req.employeeId, locationId: req.locationId },
      });
      if (balance && balance.cachedBalanceDays < 0) {
        await this.auditModel.create({
          employeeId: req.employeeId,
          locationId: req.locationId,
          eventType: 'DRIFT_DETECTED',
          deltaDays: 0,
          balanceBefore: balance.cachedBalanceDays,
          balanceAfter: balance.cachedBalanceDays,
          requestId: req.id,
          source: 'SYSTEM_SYNC',
        });
      }
    }
  }

  async getStatus() {
    const last = await this.syncRunModel.findOne({
      order: [['startedAt', 'DESC']],
    });
    const interval = parseInt(
      this.config.get('SYNC_INTERVAL_MINUTES', '60'),
      10,
    );
    const nextSync = last?.completedAt
      ? new Date(last.completedAt.getTime() + interval * 60 * 1000)
      : null;
    return { lastRun: last, nextScheduledSync: nextSync };
  }

  async getHistory(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.syncRunModel.findAndCountAll({
      limit,
      offset,
      order: [['startedAt', 'DESC']],
    });
    return { data: rows, meta: { total: count, page, limit } };
  }
}
