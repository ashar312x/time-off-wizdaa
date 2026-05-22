import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Employee } from './employee.model';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

@Table({
  tableName: 'example_hr_time_off_requests',
  timestamps: true,
  underscored: true,
})
export class TimeOffRequest extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Employee)
  @Column({ type: DataType.UUID, allowNull: false })
  declare employeeId: string;

  @BelongsTo(() => Employee)
  declare employee: Employee;

  @Column({ type: DataType.UUID, allowNull: false })
  declare locationId: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare startDate: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare endDate: string;

  @Column({ type: DataType.REAL, allowNull: false })
  declare requestedDays: number;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'PENDING' })
  declare status: RequestStatus;

  @Column(DataType.TEXT)
  declare reason: string | null;

  @Column(DataType.UUID)
  declare reviewedBy: string | null;

  @Column(DataType.DATE)
  declare reviewedAt: Date | null;

  @Column(DataType.STRING)
  declare hcmDeductionRef: string | null;
}
