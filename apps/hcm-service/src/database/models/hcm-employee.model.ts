import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  HasMany,
} from 'sequelize-typescript';
import { HcmBalance } from './hcm-balance.model';

@Table({ tableName: 'hcm_employees', timestamps: true, underscored: true })
export class HcmEmployee extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare fullName: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @HasMany(() => HcmBalance)
  declare balances: HcmBalance[];
}
