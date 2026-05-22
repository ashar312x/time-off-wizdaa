import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class AnniversaryDto {
  @ApiProperty({ description: 'Employee UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ description: 'Location UUID', example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' })
  @IsString()
  locationId!: string;

  @ApiProperty({ description: 'Number of bonus days to credit', minimum: 0, example: 5 })
  @IsNumber()
  @Min(0)
  bonusDays!: number;
}
