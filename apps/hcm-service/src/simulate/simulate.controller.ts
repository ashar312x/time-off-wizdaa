import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { SimulateService } from './simulate.service';
import { AnniversaryDto } from './dto/anniversary.dto';
import { YearResetDto } from './dto/year-reset.dto';
import { AnniversaryResponseDto, YearResetResponseDto } from './dto/simulate-response.dto';

@ApiTags('Simulate')
@Controller('hcm/simulate')
export class SimulateController {
  constructor(private readonly simulateService: SimulateService) {}

  @Post('anniversary')
  @ApiOperation({
    summary: 'Simulate anniversary bonus',
    description: 'Credits bonus days to a specific employee/location balance to simulate an annual anniversary accrual event.',
  })
  @ApiCreatedResponse({ type: AnniversaryResponseDto })
  async anniversary(@Body() dto: AnniversaryDto) {
    const data = await this.simulateService.anniversaryBonus(
      dto.employeeId,
      dto.locationId,
      dto.bonusDays,
    );
    return { data, error: null };
  }

  @Post('year-reset')
  @ApiOperation({
    summary: 'Simulate year-end balance reset',
    description: 'Resets every employee/location balance to the specified value, simulating a new-year accrual cycle.',
  })
  @ApiCreatedResponse({ type: YearResetResponseDto })
  async yearReset(@Body() dto: YearResetDto) {
    const data = await this.simulateService.yearReset(dto.resetValue);
    return { data, error: null };
  }
}
