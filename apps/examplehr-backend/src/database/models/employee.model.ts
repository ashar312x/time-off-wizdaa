import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

export type EmployeeRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

@Table({ tableName: 'example_hr_employees', timestamps: true, underscored: true })
export class Employee extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare fullName: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare passwordHash: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'EMPLOYEE' })
  declare role: EmployeeRole;

  @Column(DataType.UUID)
  declare managerId: string | null;

  @Column({ type: DataType.UUID, allowNull: false, unique: true })
  declare hcmEmployeeId: string;
}
