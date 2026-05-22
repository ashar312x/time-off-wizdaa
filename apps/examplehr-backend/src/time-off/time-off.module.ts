import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';
import { TimeOffRequest } from '../database/models/time-off-request.model';
import { Balance } from '../database/models/balance.model';
import { Employee } from '../database/models/employee.model';
import { Location } from '../database/models/location.model';
import { BalanceModule } from '../balance/balance.module';
import { HcmClientModule } from '../hcm-client/hcm-client.module';

@Module({
  imports: [
    BalanceModule,
    HcmClientModule,
    SequelizeModule.forFeature([
      TimeOffRequest,
      Balance,
      Employee,
      Location,
    ]),
  ],
  controllers: [TimeOffController],
  providers: [TimeOffService],
  exports: [TimeOffService],
})
export class TimeOffModule {}
