import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HcmClientService } from '../hcm-client/hcm-client.service';

describe('HealthController', () => {
  let controller: HealthController;
  let hcmClient: { healthCheck: jest.Mock };

  beforeEach(async () => {
    hcmClient = { healthCheck: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HcmClientService, useValue: hcmClient }],
    }).compile();

    controller = module.get(HealthController);
  });

  describe('check', () => {
    it('returns status ok and hcmReachable: true when HCM is up', async () => {
      hcmClient.healthCheck.mockResolvedValue(true);

      const result = await controller.check();

      expect(result).toEqual({ status: 'ok', hcmReachable: true });
    });

    it('returns status ok and hcmReachable: false when HCM is unreachable', async () => {
      hcmClient.healthCheck.mockResolvedValue(false);

      const result = await controller.check();

      expect(result).toEqual({ status: 'ok', hcmReachable: false });
    });
  });
});
