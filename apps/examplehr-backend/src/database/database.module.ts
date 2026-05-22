import { Module, Global } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Employee } from './models/employee.model';
import { Location } from './models/location.model';
import { Balance } from './models/balance.model';
import { TimeOffRequest } from './models/time-off-request.model';
import { BalanceAuditLog } from './models/balance-audit-log.model';
import { SyncRun } from './models/sync-run.model';
import { AuthToken } from './models/auth-token.model';

@Global()
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'sqlite',
        storage: config.get('DB_PATH', './examplehr.sqlite'),
        models: [
          Employee,
          Location,
          Balance,
          TimeOffRequest,
          BalanceAuditLog,
          SyncRun,
          AuthToken,
        ],
        autoLoadModels: true,
        synchronize: true,
        logging: config.get('NODE_ENV') === 'development' ? console.log : false,
      }),
    }),
    SequelizeModule.forFeature([
      Employee,
      Location,
      Balance,
      TimeOffRequest,
      BalanceAuditLog,
      SyncRun,
      AuthToken,
    ]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
