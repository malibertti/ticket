import { Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { DbService } from './db.service';

@Controller('db')
export class DbController {
  constructor(private readonly dbs: DbService) {}

  @Post('seed')
  @Roles(['admins'])
  seed() {
    return this.dbs.seed();
  }

  @Post('truncate')
  @Roles(['admins'])
  truncate() {
    return this.dbs.truncate();
  }
}
