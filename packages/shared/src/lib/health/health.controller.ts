import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../auth';

@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return { status: 'ok' };
  }
}
