import { Module } from '@nestjs/common';
import { StreamPoller } from './stream.poller';

@Module({
  providers: [StreamPoller],
})
export class PublisherModule {}
