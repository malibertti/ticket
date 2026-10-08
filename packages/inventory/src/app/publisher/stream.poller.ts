import {
  DescribeStreamCommand,
  DynamoDBStreamsClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListStreamsCommand,
  type ShardIteratorType,
} from '@aws-sdk/client-dynamodb-streams';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaProducer } from '@org/shared/kafka';
import { EnvService } from '../env/env.service';
import {
  publishStreamRecord,
  type StreamRecordLike,
} from './publishStreamRecord';

interface ShardState {
  iterator?: string;
  lastSequence?: string; // last record published, to resume after a failure
  closed: boolean;
}

/**
 * Local development only: reads the events table's DynamoDB stream and publishes each record.
 * In AWS a Lambda does this. Starts from the latest record, so events written while the poller
 * is down are skipped. Positions are kept in memory, so every restart does the same.
 */
@Injectable()
export class StreamPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StreamPoller.name);
  private readonly intervalMs = 1_000;
  private readonly shards = new Map<string, ShardState>();
  private readonly client: DynamoDBStreamsClient;
  private timer?: NodeJS.Timeout;
  private running = false;
  private streamArn?: string;

  constructor(
    private readonly env: EnvService,
    private readonly producer: KafkaProducer,
  ) {
    const endpoint = env.get('DYNAMODB_LOCAL_ENDPOINT');

    this.client = new DynamoDBStreamsClient({
      region: env.get('AWS_REGION'),
      ...(endpoint && {
        endpoint,
        credentials: {
          accessKeyId: env.get('AWS_ACCESS_KEY_ID') ?? 'local',
          secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY') ?? 'local',
        },
      }),
    });
  }

  onApplicationBootstrap() {
    if (!this.env.get('STREAM_POLLER')) {
      return;
    }

    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
    this.logger.log('Stream poller started');
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    this.client.destroy();
  }

  private async tick() {
    if (this.running) return;

    this.running = true;

    try {
      await this.poll();
    } catch (err) {
      this.logger.warn({ err }, 'Stream poll failed');
    } finally {
      this.running = false;
    }
  }

  private async poll() {
    this.streamArn ??= await this.findStreamArn();

    const { StreamDescription } = await this.client.send(
      new DescribeStreamCommand({ StreamArn: this.streamArn }),
    );

    // new shards appear over time; closed ones are kept so they aren't read again
    for (const shard of StreamDescription?.Shards ?? []) {
      if (!this.shards.has(shard.ShardId!)) {
        this.shards.set(shard.ShardId!, { closed: false });
      }
    }

    for (const [shardId, state] of this.shards) {
      if (!state.closed) {
        await this.readShard(shardId, state);
      }
    }
  }

  private async readShard(shardId: string, state: ShardState) {
    state.iterator ??= await this.iteratorFor(shardId, state.lastSequence);

    const { Records, NextShardIterator } = await this.client.send(
      new GetRecordsCommand({ ShardIterator: state.iterator }),
    );

    for (const record of Records ?? []) {
      this.logger.debug(record, 'publishStreamRecord');
      try {
        await publishStreamRecord(this.producer, record as StreamRecordLike);
        state.lastSequence = record.dynamodb?.SequenceNumber;
      } catch (err) {
        // resume after the last published record on the next tick
        state.iterator = undefined;
        throw err;
      }
    }

    state.iterator = NextShardIterator;
    state.closed = !NextShardIterator;
  }

  private async iteratorFor(shardId: string, after?: string) {
    const type: ShardIteratorType = after ? 'AFTER_SEQUENCE_NUMBER' : 'LATEST'; // : 'TRIM_HORIZON';

    const { ShardIterator } = await this.client.send(
      new GetShardIteratorCommand({
        StreamArn: this.streamArn,
        ShardId: shardId,
        ShardIteratorType: type,
        SequenceNumber: after,
      }),
    );

    return ShardIterator;
  }

  private async findStreamArn(): Promise<string> {
    const table = this.env.get('INVENTORY_EVENTS_TABLE');
    const { Streams } = await this.client.send(
      new ListStreamsCommand({ TableName: table }),
    );
    const arn = Streams?.[0]?.StreamArn;

    if (!arn) {
      throw new Error(`Table ${table} has no stream`);
    }

    return arn;
  }
}
