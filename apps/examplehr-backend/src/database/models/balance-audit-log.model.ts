import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({
  tableName: 'example_hr_balance_audit_log',
  timestamps: false,
  underscored: true,
})
export class BalanceAuditLog extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare employeeId: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare locationId: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare eventType: string;

  @Column({ type: DataType.REAL, allowNull: false })
  declare deltaDays: number;

  @Column({ type: DataType.REAL, allowNull: false })
  declare balanceBefore: number;

  @Column({ type: DataType.REAL, allowNull: false })
  declare balanceAfter: number;

  @Column(DataType.UUID)
  declare requestId: string | null;

  @Column({ type: DataType.STRING, allowNull: false })
  declare source: string;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare occurredAt: Date;
}
