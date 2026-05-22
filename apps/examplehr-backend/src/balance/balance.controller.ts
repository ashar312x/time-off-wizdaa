import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from './balance.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/balances')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get('me')
  getMyBalances(@Req() req: { user: { id: string } }) {
    return this.balanceService.getBalancesForEmployee(req.user.id);
  }

  @Get(':employeeId')
  @Roles('MANAGER', 'ADMIN')
  getEmployeeBalances(@Param('employeeId') employeeId: string) {
    return this.balanceService.getBalancesForEmployee(employeeId);
  }

  @Post(':employeeId/:locationId/sync')
  @Roles('MANAGER', 'ADMIN')
  forceSync(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balanceService.forceSync(employeeId, locationId);
  }
}
