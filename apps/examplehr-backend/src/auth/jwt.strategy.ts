import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Employee } from '../database/models/employee.model';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(Employee) private employeeModel: typeof Employee,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: JwtPayload) {
    const employee = await this.employeeModel.findByPk(payload.sub);
    if (!employee) {
      throw new UnauthorizedException({ error: 'UNAUTHORIZED' });
    }
    return {
      id: employee.id,
      email: employee.email,
      role: employee.role,
      fullName: employee.fullName,
      hcmEmployeeId: employee.hcmEmployeeId,
    };
  }
}
