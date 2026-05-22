import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Employee } from '../database/models/employee.model';
import { AuthToken } from '../database/models/auth-token.model';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Employee) private employeeModel: typeof Employee,
    @InjectModel(AuthToken) private tokenModel: typeof AuthToken,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const employee = await this.employeeModel.findOne({ where: { email } });
    if (!employee || !(await bcrypt.compare(password, employee.passwordHash))) {
      throw new UnauthorizedException({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const accessToken = this.jwtService.sign(
      { sub: employee.id, email: employee.email, role: employee.role },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '15m') },
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresIn = this.config.get('REFRESH_TOKEN_EXPIRES_IN', '7d');
    const days = parseInt(expiresIn) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresIn.includes('d') ? days : 7));

    await this.tokenModel.create({
      employeeId: employee.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.tokenModel.findOne({
      where: { tokenHash, revoked: false },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ error: 'UNAUTHORIZED' });
    }
    const employee = await this.employeeModel.findByPk(stored.employeeId);
    if (!employee) {
      throw new UnauthorizedException({ error: 'UNAUTHORIZED' });
    }
    const accessToken = this.jwtService.sign(
      { sub: employee.id, email: employee.email, role: employee.role },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '15m') },
    );
    return { accessToken };
  }

  async logout(employeeId: string) {
    await this.tokenModel.update(
      { revoked: true },
      { where: { employeeId, revoked: false } },
    );
  }
}
