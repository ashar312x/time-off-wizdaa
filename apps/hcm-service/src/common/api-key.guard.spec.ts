import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  const savedEnv = process.env.HCM_API_KEY;

  beforeEach(() => {
    guard = new ApiKeyGuard();
    delete process.env.HCM_API_KEY;
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.HCM_API_KEY = savedEnv;
    } else {
      delete process.env.HCM_API_KEY;
    }
  });

  it('allows a request that has the correct x-api-key header (default key)', () => {
    const ctx = makeContext({ 'x-api-key': 'dev-secret' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a request with a Bearer authorization header carrying the correct key', () => {
    const ctx = makeContext({ authorization: 'Bearer dev-secret' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a request with a raw (non-Bearer) authorization header', () => {
    // 'dev-secret'.replace('Bearer ', '') === 'dev-secret'
    const ctx = makeContext({ authorization: 'dev-secret' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException when no api-key header is present', () => {
    const ctx = makeContext({});

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the api key is incorrect', () => {
    const ctx = makeContext({ 'x-api-key': 'wrong-key' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the Bearer token is incorrect', () => {
    const ctx = makeContext({ authorization: 'Bearer wrong-key' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('uses HCM_API_KEY env var when set', () => {
    process.env.HCM_API_KEY = 'custom-secret';
    const ctx = makeContext({ 'x-api-key': 'custom-secret' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects the default key when a custom HCM_API_KEY is configured', () => {
    process.env.HCM_API_KEY = 'custom-secret';
    const ctx = makeContext({ 'x-api-key': 'dev-secret' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws with message "Invalid API key"', () => {
    const ctx = makeContext({});

    expect(() => guard.canActivate(ctx)).toThrow('Invalid API key');
  });

  it('x-api-key header takes precedence when both headers are present', () => {
    // implementation reads headers['x-api-key'] || headers['authorization']
    // so x-api-key is evaluated first
    const ctx = makeContext({ 'x-api-key': 'dev-secret', authorization: 'Bearer wrong' });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
