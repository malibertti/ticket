import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({
  path: 'ops',
  version: VERSION_NEUTRAL,
})
export class OpsController {
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
