import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(user: Record<string, unknown> | null): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(RolesGuard);
  });

  it('allows access when no roles metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext({ role: 'EMPLOYEE' }))).toBe(true);
  });

  it('allows access when the roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(buildContext({ role: 'EMPLOYEE' }))).toBe(true);
  });

  it('allows access when the user holds one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['MANAGER', 'ADMIN']);

    expect(guard.canActivate(buildContext({ role: 'MANAGER' }))).toBe(true);
  });

  it('allows ADMIN access to ADMIN-only endpoints', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(buildContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('throws ForbiddenException when the user role is not in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue(['MANAGER', 'ADMIN']);

    expect(() => guard.canActivate(buildContext({ role: 'EMPLOYEE' }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['MANAGER']);

    expect(() => guard.canActivate(buildContext(null))).toThrow(ForbiddenException);
  });
});
