import { Controller, Get } from '@nestjs/common';
import { HcmClientService } from '../hcm-client/hcm-client.service';

@Controller('api/health')
export class HealthController {
  constructor(private hcmClient: HcmClientService) {}

  @Get()
  async check() {
    const hcmReachable = await this.hcmClient.healthCheck();
    return { status: 'ok', hcmReachable };
  }
}
