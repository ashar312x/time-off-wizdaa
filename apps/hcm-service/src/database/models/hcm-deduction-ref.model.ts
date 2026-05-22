import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({
  tableName: 'hcm_deduction_refs',
  timestamps: true,
  underscored: true,
})
export class HcmDeductionRef extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare referenceId: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare employeeId: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare locationId: string;

  @Column({ type: DataType.REAL, allowNull: false })
  declare days: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare operation: string;

  @Column({ type: DataType.REAL, allowNull: false })
  declare balanceAfter: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare versionAfter: number;
}
