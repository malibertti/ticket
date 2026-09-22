import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

@Controller({
  path: 'ops',
  version: VERSION_NEUTRAL,
})
export class OpsController {
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
