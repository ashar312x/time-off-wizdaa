jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { Employee } from '../database/models/employee.model';
import { AuthToken } from '../database/models/auth-token.model';

const mockEmployee = {
  id: 'emp-uuid-1',
  fullName: 'Alice Smith',
  email: 'alice@example.com',
  passwordHash: '$2a$10$hashedpassword',
  role: 'EMPLOYEE' as const,
  hcmEmployeeId: 'hcm-emp-uuid-1',
};

describe('AuthService', () => {
  let service: AuthService;
  let employeeModel: { findOne: jest.Mock; findByPk: jest.Mock };
  let tokenModel: { findOne: jest.Mock; create: jest.Mock; update: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    employeeModel = { findOne: jest.fn(), findByPk: jest.fn() };
    tokenModel = { findOne: jest.fn(), create: jest.fn(), update: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('mock-access-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(Employee), useValue: employeeModel },
        { provide: getModelToken(AuthToken), useValue: tokenModel },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockImplementation((_k: string, d: unknown) => d) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('returns tokens and employee info on valid credentials', async () => {
      employeeModel.findOne.mockResolvedValue(mockEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenModel.create.mockResolvedValue({});

      const result = await service.login('alice@example.com', 'password123');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
      expect(result.employee).toEqual({
        id: mockEmployee.id,
        fullName: mockEmployee.fullName,
        email: mockEmployee.email,
        role: mockEmployee.role,
      });
    });

    it('stores a hashed refresh token in the database', async () => {
      employeeModel.findOne.mockResolvedValue(mockEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenModel.create.mockResolvedValue({});

      await service.login('alice@example.com', 'password123');

      expect(tokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: mockEmployee.id }),
      );
    });

    it('throws UnauthorizedException when employee is not found', async () => {
      employeeModel.findOne.mockResolvedValue(null);

      await expect(service.login('unknown@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      employeeModel.findOne.mockResolvedValue(mockEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('alice@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('signs the JWT with employee sub, email, and role', async () => {
      employeeModel.findOne.mockResolvedValue(mockEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenModel.create.mockResolvedValue({});

      await service.login('alice@example.com', 'password123');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockEmployee.id, email: mockEmployee.email, role: mockEmployee.role },
        expect.any(Object),
      );
    });
  });

  describe('refresh', () => {
    const validStoredToken = {
      employeeId: mockEmployee.id,
      expiresAt: new Date(Date.now() + 86_400_000),
      revoked: false,
    };

    it('returns a new access token for a valid refresh token', async () => {
      tokenModel.findOne.mockResolvedValue(validStoredToken);
      employeeModel.findByPk.mockResolvedValue(mockEmployee);

      const result = await service.refresh('valid-raw-token');

      expect(result).toEqual({ accessToken: 'mock-access-token' });
    });

    it('throws UnauthorizedException when the token record is not found', async () => {
      tokenModel.findOne.mockResolvedValue(null);

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the token is expired', async () => {
      tokenModel.findOne.mockResolvedValue({
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the employee no longer exists', async () => {
      tokenModel.findOne.mockResolvedValue(validStoredToken);
      employeeModel.findByPk.mockResolvedValue(null);

      await expect(service.refresh('valid-raw-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes all active tokens for the employee', async () => {
      tokenModel.update.mockResolvedValue([1]);

      await service.logout(mockEmployee.id);

      expect(tokenModel.update).toHaveBeenCalledWith(
        { revoked: true },
        { where: { employeeId: mockEmployee.id, revoked: false } },
      );
    });
  });
});
