import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({ tableName: 'example_hr_balances', timestamps: true, underscored: true })
export class Balance extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare employeeId: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare locationId: string;

  @Column({ type: DataType.REAL, allowNull: false, defaultValue: 0 })
  declare cachedBalanceDays: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare hcmVersion: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare lastSyncedAt: Date;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isStale: boolean;
}
