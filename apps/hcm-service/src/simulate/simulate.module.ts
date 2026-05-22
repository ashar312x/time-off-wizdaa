import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SimulateController } from './simulate.controller';
import { SimulateService } from './simulate.service';
import { HcmBalance } from '../database/models/hcm-balance.model';
import { HcmBalanceEvent } from '../database/models/hcm-balance-event.model';

@Module({
  imports: [SequelizeModule.forFeature([HcmBalance, HcmBalanceEvent])],
  controllers: [SimulateController],
  providers: [SimulateService],
})
export class SimulateModule {}
