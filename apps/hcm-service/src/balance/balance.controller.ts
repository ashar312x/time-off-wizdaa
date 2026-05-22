import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiUnprocessableEntityResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { BalanceService } from './balance.service';
import { DeductDto } from './dto/deduct.dto';
import {
  BalanceResponseDto,
  BatchBalanceResponseDto,
} from './dto/balance-response.dto';
import { ApiKeyGuard } from '../common/api-key.guard';
import { FailureSimulatorInterceptor } from '../common/failure-simulator.interceptor';

@ApiTags('Balances')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({ description: 'Missing or invalid x-api-key header' })
@ApiServiceUnavailableResponse({ description: 'Simulated HCM failure (controlled by SIMULATE_FAILURE_RATE)' })
@Controller('hcm/balances')
@UseGuards(ApiKeyGuard)
@UseInterceptors(FailureSimulatorInterceptor)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('batch')
  @ApiOperation({
    summary: 'List all balances (paginated)',
    description: 'Returns a paginated snapshot of all employee/location balances. Used by ExampleHR sync to reconcile its local cache.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { default: 1, minimum: 1 }, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, schema: { default: 500, minimum: 1, maximum: 1000 }, description: 'Records per page' })
  @ApiOkResponse({ type: BatchBalanceResponseDto })
  async getBatch(
    @Query('page') page = '1',
    @Query('limit') limit = '500',
  ) {
    const result = await this.balanceService.getBatch(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { data: result.data, meta: result.meta, error: null };
  }

  @Get(':employeeId/:locationId')
  @ApiOperation({ summary: 'Get a single employee/location balance' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiParam({ name: 'locationId', description: 'Location UUID' })
  @ApiOkResponse({ type: BalanceResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_COMBINATION — no balance record for this employee/location pair' })
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    const data = await this.balanceService.getBalance(employeeId, locationId);
    return { data, error: null };
  }

  @Patch(':employeeId/:locationId/deduct')
  @ApiOperation({
    summary: 'Deduct days from a balance',
    description: 'Atomically subtracts days from the balance using optimistic locking. Supply `referenceId` for idempotent retries (24-hour window).',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiParam({ name: 'locationId', description: 'Location UUID' })
  @ApiOkResponse({ type: BalanceResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_COMBINATION or INSUFFICIENT_BALANCE' })
  @ApiConflictResponse({ description: 'VERSION_CONFLICT — concurrent modification detected, retry the request' })
  async deduct(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Body() dto: DeductDto,
  ) {
    const data = await this.balanceService.deduct(
      employeeId,
      locationId,
      dto.days,
      dto.referenceId,
    );
    return { data, error: null };
  }

  @Patch(':employeeId/:locationId/credit')
  @ApiOperation({
    summary: 'Credit days to a balance',
    description: 'Atomically adds days to the balance. Supply `referenceId` for idempotent retries (24-hour window).',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiParam({ name: 'locationId', description: 'Location UUID' })
  @ApiOkResponse({ type: BalanceResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_COMBINATION — no balance record for this employee/location pair' })
  async credit(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Body() dto: DeductDto,
  ) {
    const data = await this.balanceService.credit(
      employeeId,
      locationId,
      dto.days,
      dto.referenceId,
    );
    return { data, error: null };
  }
}
