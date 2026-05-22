import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({
  tableName: 'hcm_balance_events',
  timestamps: false,
  underscored: true,
})
export class HcmBalanceEvent extends Model {
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

  @Column(DataType.STRING)
  declare triggeredBy: string | null;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare occurredAt: Date;
}
