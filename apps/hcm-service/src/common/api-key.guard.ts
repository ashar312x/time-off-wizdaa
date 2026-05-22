import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-api-key'] || req.headers['authorization'];
    const expected = process.env.HCM_API_KEY || 'dev-secret';
    if (!key || String(key).replace('Bearer ', '') !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
