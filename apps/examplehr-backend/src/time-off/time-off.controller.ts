import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { TimeOffService } from './time-off.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateRequestDto {
  @IsString()
  locationId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0.01)
  requestedDays!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('api/time-off')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TimeOffController {
  constructor(private timeOffService: TimeOffService) {}

  @Get('pending')
  @Roles('MANAGER', 'ADMIN')
  listPending() {
    return this.timeOffService.listPending();
  }

  @Get()
  listOwn(
    @Req() req: { user: { id: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.timeOffService.listOwn(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post()
  @Roles('EMPLOYEE', 'MANAGER', 'ADMIN')
  submit(@Req() req: { user: { id: string } }, @Body() dto: CreateRequestDto) {
    return this.timeOffService.submit(req.user.id, dto);
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    return this.timeOffService.getById(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'ADMIN')
  cancel(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.timeOffService.cancel(id, req.user.id);
  }

  @Patch(':id/approve')
  @Roles('MANAGER', 'ADMIN')
  approve(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.timeOffService.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles('MANAGER', 'ADMIN')
  reject(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
    @Body() dto: RejectDto,
  ) {
    return this.timeOffService.reject(id, req.user.id, dto.reason);
  }
}
