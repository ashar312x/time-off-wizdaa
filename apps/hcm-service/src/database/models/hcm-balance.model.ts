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
import { HcmEmployee } from './hcm-employee.model';
import { HcmLocation } from './hcm-location.model';

@Table({
  tableName: 'hcm_balances',
  timestamps: false,
  underscored: true,
})
export class HcmBalance extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => HcmEmployee)
  @Column({ type: DataType.UUID, allowNull: false })
  declare employeeId: string;

  @ForeignKey(() => HcmLocation)
  @Column({ type: DataType.UUID, allowNull: false })
  declare locationId: string;

  @Column({ type: DataType.REAL, allowNull: false, defaultValue: 0 })
  declare balanceDays: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare version: number;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare lastModified: Date;

  @BelongsTo(() => HcmEmployee)
  declare employee: HcmEmployee;

  @BelongsTo(() => HcmLocation)
  declare location: HcmLocation;
}
