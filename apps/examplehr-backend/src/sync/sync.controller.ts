import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/sync')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }

  @Post('trigger')
  trigger() {
    return this.syncService.runSync('MANUAL');
  }

  @Get('history')
  getHistory(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.syncService.getHistory(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
