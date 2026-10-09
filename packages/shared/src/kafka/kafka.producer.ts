import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IHeaders, Kafka } from 'kafkajs';
import { KafkaPublisher, Topic, type KafkaConfig } from '../kafka-core';
import { currentTraceContext } from '../telemetry';
import { KAFKA_CONFIG } from './config';

/** KafkaPublisher for Nest apps: connects on startup, logs, and continues the current trace. */
@Injectable()
export class KafkaProducer
  extends KafkaPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaProducer.name);

  constructor(
    kafka: Kafka,
    registry: SchemaRegistry,
    @Inject(KAFKA_CONFIG) config: KafkaConfig,
  ) {
    super(kafka, registry);
    this.logger.debug({ clientId: config.clientId }, 'Producer created');
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (err) {
      this.logger.warn(
        { err },
        'Producer did not connect, will retry on publish',
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.disconnect();
      this.logger.debug('Producer disconnected');
    } catch (err) {
      this.logger.warn({ err }, 'Producer did not disconnect');
    }
  }

  override publish(
    topic: Topic,
    key: string,
    message: object,
    headers: IHeaders = currentTraceContext(),
  ): Promise<void> {
    return super.publish(topic, key, message, headers);
  }

  protected override async registerSchema(topic: Topic): Promise<number> {
    const id = await super.registerSchema(topic);

    this.logger.log({ topic, schemaId: id }, 'Schema registered');

    return id;
  }
}
