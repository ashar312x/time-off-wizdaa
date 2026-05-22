import { Sequelize } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { HcmEmployee } from './models/hcm-employee.model';
import { HcmLocation } from './models/hcm-location.model';
import { HcmBalance } from './models/hcm-balance.model';
import { HcmBalanceEvent } from './models/hcm-balance-event.model';
import { HcmDeductionRef } from './models/hcm-deduction-ref.model';

const EMPLOYEES = [
  { id: 'e1-hcm-0001-0001-0001-000000000001', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 'e1-hcm-0001-0001-0001-000000000002', name: 'Bob Smith', email: 'bob@example.com' },
  { id: 'e1-hcm-0001-0001-0001-000000000003', name: 'Carol Manager', email: 'carol@example.com' },
  { id: 'e1-hcm-0001-0001-0001-000000000004', name: 'Dave Admin', email: 'admin@example.com' },
];

const LOCATIONS = [
  { id: 'loc-hcm-0001-0001-0001-000000000001', name: 'New York HQ', country: 'US' },
  { id: 'loc-hcm-0001-0001-0001-000000000002', name: 'London Office', country: 'GB' },
];

async function seed() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './hcm.sqlite',
    models: [HcmEmployee, HcmLocation, HcmBalance, HcmBalanceEvent, HcmDeductionRef],
    logging: false,
  });

  await sequelize.sync({ force: true });

  for (const loc of LOCATIONS) {
    await HcmLocation.create({ id: loc.id, name: loc.name, countryCode: loc.country });
  }

  for (const emp of EMPLOYEES) {
    await HcmEmployee.create({ id: emp.id, fullName: emp.name, email: emp.email });
    for (const loc of LOCATIONS) {
      const days = emp.email === 'alice@example.com' && loc.country === 'US' ? 15 : 10;
      await HcmBalance.create({
        id: uuidv4(),
        employeeId: emp.id,
        locationId: loc.id,
        balanceDays: days,
        version: 1,
      });
    }
  }

  console.log('HCM database seeded successfully');
  await sequelize.close();
}

seed().catch(console.error);
