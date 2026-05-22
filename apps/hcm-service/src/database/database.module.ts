import { Module, Global } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { HcmEmployee } from './models/hcm-employee.model';
import { HcmLocation } from './models/hcm-location.model';
import { HcmBalance } from './models/hcm-balance.model';
import { HcmBalanceEvent } from './models/hcm-balance-event.model';
import { HcmDeductionRef } from './models/hcm-deduction-ref.model';

@Global()
@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'sqlite',
      storage: process.env.DB_PATH || './hcm.sqlite',
      models: [
        HcmEmployee,
        HcmLocation,
        HcmBalance,
        HcmBalanceEvent,
        HcmDeductionRef,
      ],
      autoLoadModels: true,
      synchronize: true,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    }),
    SequelizeModule.forFeature([
      HcmEmployee,
      HcmLocation,
      HcmBalance,
      HcmBalanceEvent,
      HcmDeductionRef,
    ]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
