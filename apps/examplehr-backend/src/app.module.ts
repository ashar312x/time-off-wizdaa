import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { BalanceModule } from './balance/balance.module';
import { TimeOffModule } from './time-off/time-off.module';
import { SyncModule } from './sync/sync.module';
import { HcmClientModule } from './hcm-client/hcm-client.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HcmClientModule,
    AuthModule,
    BalanceModule,
    TimeOffModule,
    SyncModule,
    HealthModule,
  ],
})
export class AppModule {}
