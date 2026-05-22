import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { HcmBalance } from '../database/models/hcm-balance.model';
import { HcmBalanceEvent } from '../database/models/hcm-balance-event.model';
import { HcmDeductionRef } from '../database/models/hcm-deduction-ref.model';

@Module({
  imports: [
    SequelizeModule.forFeature([HcmBalance, HcmBalanceEvent, HcmDeductionRef]),
  ],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
