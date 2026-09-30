import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '@org/shared/auth';
import { SalesService } from './sales.service';

@Controller('events/:eventId')
@Roles(['admins'])
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post('open-sales')
  @HttpCode(200)
  openSales(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.sales.openSales(eventId);
  }

  @Post('resync')
  @HttpCode(200)
  resync(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.sales.resync(eventId);
  }
}
