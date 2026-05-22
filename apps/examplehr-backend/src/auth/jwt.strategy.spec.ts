import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { JwtStrategy } from './jwt.strategy';
import { Employee } from '../database/models/employee.model';

const mockEmployee = {
  id: 'emp-uuid-1',
  fullName: 'Alice Smith',
  email: 'alice@example.com',
  role: 'EMPLOYEE',
  hcmEmployeeId: 'hcm-emp-uuid-1',
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let employeeModel: { findByPk: jest.Mock };

  beforeEach(async () => {
    employeeModel = { findByPk: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: getModelToken(Employee), useValue: employeeModel },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  describe('validate', () => {
    it('returns the user object when the employee exists', async () => {
      employeeModel.findByPk.mockResolvedValue(mockEmployee);

      const result = await strategy.validate({
        sub: 'emp-uuid-1',
        email: 'alice@example.com',
        role: 'EMPLOYEE',
      });

      expect(result).toEqual({
        id: mockEmployee.id,
        email: mockEmployee.email,
        role: mockEmployee.role,
        fullName: mockEmployee.fullName,
        hcmEmployeeId: mockEmployee.hcmEmployeeId,
      });
      expect(employeeModel.findByPk).toHaveBeenCalledWith('emp-uuid-1');
    });

    it('throws UnauthorizedException when the employee does not exist', async () => {
      employeeModel.findByPk.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'deleted-id', email: 'none@example.com', role: 'EMPLOYEE' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
