import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockLoginResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  employee: { id: 'emp-1', fullName: 'Alice', email: 'alice@example.com', role: 'EMPLOYEE' },
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'login' | 'refresh' | 'logout'>>;

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockLoginResponse),
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-access-token' }),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('login', () => {
    it('delegates to authService.login and returns the result', async () => {
      const dto = { email: 'alice@example.com', password: 'password123' };

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto.email, dto.password);
      expect(result).toEqual(mockLoginResponse);
    });
  });

  describe('refresh', () => {
    it('delegates to authService.refresh and returns a new access token', async () => {
      const dto = { refreshToken: 'raw-refresh-token' };

      const result = await controller.refresh(dto);

      expect(authService.refresh).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });
  });

  describe('logout', () => {
    it('delegates to authService.logout with the authenticated user id', async () => {
      const req = { user: { id: 'emp-1' } };

      await controller.logout(req);

      expect(authService.logout).toHaveBeenCalledWith('emp-1');
    });
  });
});
