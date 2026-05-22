import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface HcmBalanceDto {
  employeeId: string;
  locationId: string;
  balanceDays: number;
  version: number;
}

@Injectable()
export class HcmClientService {
  private readonly logger = new Logger(HcmClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.baseUrl = config.get('HCM_BASE_URL', 'http://localhost:3001/hcm');
    this.apiKey = config.get('HCM_API_KEY', 'dev-secret');
  }

  private headers() {
    return { 'x-api-key': this.apiKey };
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    const delays = [1000, 2000, 4000];
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        const axiosErr = err as AxiosError;
        if (axiosErr.response && axiosErr.response.status < 500) {
          throw err;
        }
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
    }
    this.logger.error('HCM unavailable after retries', lastError?.stack);
    throw new ServiceUnavailableException({
      error: 'HCM_UNAVAILABLE',
      message: 'HCM did not respond after retries',
    });
  }

  async getBalance(
    hcmEmployeeId: string,
    hcmLocationId: string,
  ): Promise<HcmBalanceDto> {
    return this.withRetry(async () => {
      const start = Date.now();
      const { data } = await firstValueFrom(
        this.http.get(
          `${this.baseUrl}/balances/${hcmEmployeeId}/${hcmLocationId}`,
          { headers: this.headers() },
        ),
      );
      this.logger.debug(`HCM GET balance ${Date.now() - start}ms`);
      return data.data;
    });
  }

  async deduct(
    hcmEmployeeId: string,
    hcmLocationId: string,
    days: number,
    referenceId: string,
  ): Promise<HcmBalanceDto> {
    return this.withRetry(async () => {
      try {
        const { data } = await firstValueFrom(
          this.http.patch(
            `${this.baseUrl}/balances/${hcmEmployeeId}/${hcmLocationId}/deduct`,
            { days, referenceId },
            { headers: this.headers() },
          ),
        );
        return data.data;
      } catch (err) {
        this.mapHcmError(err as AxiosError);
        throw err;
      }
    });
  }

  async credit(
    hcmEmployeeId: string,
    hcmLocationId: string,
    days: number,
    referenceId: string,
  ): Promise<HcmBalanceDto> {
    return this.withRetry(async () => {
      const { data } = await firstValueFrom(
        this.http.patch(
          `${this.baseUrl}/balances/${hcmEmployeeId}/${hcmLocationId}/credit`,
          { days, referenceId },
          { headers: this.headers() },
        ),
      );
      return data.data;
    });
  }

  async getBatch(page = 1, limit = 500) {
    return this.withRetry(async () => {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/balances/batch`, {
          headers: this.headers(),
          params: { page, limit },
        }),
      );
      return data;
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.get(`${this.baseUrl}/balances/batch`, {
          headers: this.headers(),
          params: { page: 1, limit: 1 },
          timeout: 3000,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private mapHcmError(err: AxiosError): void {
    const body = err.response?.data as Record<string, unknown>;
    const nested = body?.error as Record<string, unknown> | string | undefined;
    const code =
      typeof nested === 'string'
        ? nested
        : (nested as { error?: string })?.error ?? (body?.error as string);
    if (code === 'INSUFFICIENT_BALANCE') {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        message: (body?.message as string) || 'Insufficient balance',
        availableDays: (body as { availableDays?: number })?.availableDays,
      });
    }
    if (code === 'VERSION_CONFLICT') {
      throw new ConflictException({
        error: 'CONCURRENT_MODIFICATION',
        message: 'Concurrent modification',
      });
    }
  }
}
