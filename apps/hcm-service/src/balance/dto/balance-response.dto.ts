import { ApiProperty } from '@nestjs/swagger';

export class BalanceDataDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  employeeId!: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' })
  locationId!: string;

  @ApiProperty({ example: 12.5, description: 'Remaining leave balance in days' })
  balanceDays!: number;

  @ApiProperty({ example: 3, description: 'Optimistic-lock version counter' })
  version!: number;
}

export class BatchMetaDto {
  @ApiProperty({ example: 8 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 500 })
  limit!: number;
}

export class BalanceResponseDto {
  @ApiProperty({ type: BalanceDataDto })
  data!: BalanceDataDto;

  @ApiProperty({ type: String, nullable: true, example: null })
  error!: null;
}

export class BatchBalanceResponseDto {
  @ApiProperty({ type: [BalanceDataDto] })
  data!: BalanceDataDto[];

  @ApiProperty({ type: BatchMetaDto })
  meta!: BatchMetaDto;

  @ApiProperty({ type: String, nullable: true, example: null })
  error!: null;
}
