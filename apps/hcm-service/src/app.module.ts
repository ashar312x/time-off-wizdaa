import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { BalanceModule } from './balance/balance.module';
import { SimulateModule } from './simulate/simulate.module';

@Module({
  imports: [DatabaseModule, BalanceModule, SimulateModule],
})
export class AppModule {}
