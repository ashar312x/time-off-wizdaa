import { ApiProperty } from '@nestjs/swagger';

export class AnniversaryResponseDataDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  employeeId!: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' })
  locationId!: string;

  @ApiProperty({ example: 17.5 })
  balanceDays!: number;

  @ApiProperty({ example: 4 })
  version!: number;
}

export class YearResetResponseDataDto {
  @ApiProperty({ example: 8, description: 'Number of employee/location balances updated' })
  updated!: number;

  @ApiProperty({ example: 20 })
  resetValue!: number;
}

export class AnniversaryResponseDto {
  @ApiProperty({ type: AnniversaryResponseDataDto, nullable: true })
  data!: AnniversaryResponseDataDto | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  error!: null;
}

export class YearResetResponseDto {
  @ApiProperty({ type: YearResetResponseDataDto })
  data!: YearResetResponseDataDto;

  @ApiProperty({ type: String, nullable: true, example: null })
  error!: null;
}
