import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { Balance } from '../database/models/balance.model';
import { BalanceAuditLog } from '../database/models/balance-audit-log.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { HcmClientModule } from '../hcm-client/hcm-client.module';

@Module({
  imports: [
    HcmClientModule,
    SequelizeModule.forFeature([Balance, BalanceAuditLog, Employee, Location]),
  ],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
