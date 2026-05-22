import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from './models/employee.model';
import { Location } from './models/location.model';
import { Balance } from './models/balance.model';
import { TimeOffRequest } from './models/time-off-request.model';
import { BalanceAuditLog } from './models/balance-audit-log.model';
import { SyncRun } from './models/sync-run.model';
import { AuthToken } from './models/auth-token.model';

const HCM_EMPLOYEES = [
  { hcmId: 'e1-hcm-0001-0001-0001-000000000001', name: 'Alice Johnson', email: 'alice@example.com', role: 'EMPLOYEE' as const },
  { hcmId: 'e1-hcm-0001-0001-0001-000000000002', name: 'Bob Smith', email: 'bob@example.com', role: 'EMPLOYEE' as const },
  { hcmId: 'e1-hcm-0001-0001-0001-000000000003', name: 'Carol Manager', email: 'carol@example.com', role: 'MANAGER' as const },
  { hcmId: 'e1-hcm-0001-0001-0001-000000000004', name: 'Dave Admin', email: 'admin@example.com', role: 'ADMIN' as const },
];

const HCM_LOCATIONS = [
  { hcmId: 'loc-hcm-0001-0001-0001-000000000001', name: 'New York HQ', country: 'US' },
  { hcmId: 'loc-hcm-0001-0001-0001-000000000002', name: 'London Office', country: 'GB' },
];

const EMPLOYEE_IDS: Record<string, string> = {};

async function seed() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './examplehr.sqlite',
    models: [Employee, Location, Balance, TimeOffRequest, BalanceAuditLog, SyncRun, AuthToken],
    logging: false,
  });

  await sequelize.sync({ force: true });
  const passwordHash = await bcrypt.hash('password123', 12);

  const managerHcmId = 'e1-hcm-0001-0001-0001-000000000003';
  let managerId: string | null = null;

  for (const emp of HCM_EMPLOYEES) {
    const id = uuidv4();
    EMPLOYEE_IDS[emp.email] = id;
    if (emp.hcmId === managerHcmId) managerId = id;
    await Employee.create({
      id,
      fullName: emp.name,
      email: emp.email,
      passwordHash,
      role: emp.role,
      managerId: emp.role === 'EMPLOYEE' ? managerId : null,
      hcmEmployeeId: emp.hcmId,
    });
  }

  const locationIds: string[] = [];
  for (const loc of HCM_LOCATIONS) {
    const id = uuidv4();
    locationIds.push(id);
    await Location.create({
      id,
      name: loc.name,
      countryCode: loc.country,
      hcmLocationId: loc.hcmId,
    });
  }

  for (const emp of HCM_EMPLOYEES) {
    const employeeId = EMPLOYEE_IDS[emp.email];
    for (let i = 0; i < HCM_LOCATIONS.length; i++) {
      const days = emp.email === 'alice@example.com' && i === 0 ? 15 : 10;
      await Balance.create({
        id: uuidv4(),
        employeeId,
        locationId: locationIds[i],
        cachedBalanceDays: days,
        hcmVersion: 1,
        lastSyncedAt: new Date(),
        isStale: false,
      });
    }
  }

  console.log('ExampleHR database seeded. Login: alice@example.com / password123');
  await sequelize.close();
}

seed().catch(console.error);
