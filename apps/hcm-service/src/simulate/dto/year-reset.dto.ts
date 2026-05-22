import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class YearResetDto {
  @ApiProperty({ description: 'Target balance days to reset all employees to', minimum: 0, example: 20 })
  @IsNumber()
  @Min(0)
  resetValue!: number;
}
