import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

@Injectable()
export class FailureSimulatorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rate = parseFloat(process.env.SIMULATE_FAILURE_RATE || '0');
    if (rate > 0 && Math.random() < rate) {
      return throwError(
        () => new ServiceUnavailableException('HCM simulated outage'),
      );
    }
    return next.handle();
  }
}
