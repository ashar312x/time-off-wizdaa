import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class DeductDto {
  @ApiProperty({ description: 'Number of days to deduct or credit', minimum: 0.01, example: 2.5 })
  @IsNumber()
  @Min(0.01)
  days!: number;

  @ApiPropertyOptional({ description: 'Idempotency key — duplicate requests within 24 h return the cached result', example: 'req-timeoff-42' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
