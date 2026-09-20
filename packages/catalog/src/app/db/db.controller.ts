import { Controller, Post } from '@nestjs/common';
import { DbService } from './db.service';

@Controller('db')
export class DbController {
  constructor(private readonly dbs: DbService) {}

  @Post('seed')
  seed() {
    return this.dbs.seed();
  }

  @Post('truncate')
  truncate() {
    return this.dbs.truncate();
  }
}
