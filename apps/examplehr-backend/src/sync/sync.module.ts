import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { Balance } from '../database/models/balance.model';
import { SyncRun } from '../database/models/sync-run.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { TimeOffRequest } from '../database/models/time-off-request.model';
import { BalanceAuditLog } from '../database/models/balance-audit-log.model';
import { HcmClientModule } from '../hcm-client/hcm-client.module';

@Module({
  imports: [
    HcmClientModule,
    SequelizeModule.forFeature([
      Balance,
      SyncRun,
      Employee,
      Location,
      TimeOffRequest,
      BalanceAuditLog,
    ]),
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
