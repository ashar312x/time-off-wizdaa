import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HcmClientModule } from '../hcm-client/hcm-client.module';

@Module({
  imports: [HcmClientModule],
  controllers: [HealthController],
})
export class HealthModule {}
