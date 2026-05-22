import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({ tableName: 'example_hr_sync_runs', timestamps: false, underscored: true })
export class SyncRun extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare triggeredBy: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare status: string;

  @Column(DataType.INTEGER)
  declare recordsUpdated: number | null;

  @Column(DataType.INTEGER)
  declare recordsFailed: number | null;

  @Column(DataType.TEXT)
  declare errorMessage: string | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare startedAt: Date;

  @Column(DataType.DATE)
  declare completedAt: Date | null;
}
