import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { DynamicModule, Module } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import {
  createKafka,
  createSchemaRegistry,
  KAFKA_CONFIG,
  KafkaConfig,
} from './kafka.client';
import { KafkaProducer } from './kafka.producer';

@Module({})
export class KafkaModule {
  static forRoot(config: KafkaConfig): DynamicModule {
    return {
      module: KafkaModule,
      global: true,
      providers: [
        { provide: KAFKA_CONFIG, useValue: config },
        { provide: Kafka, useFactory: () => createKafka(config) },
        {
          provide: SchemaRegistry,
          useFactory: () => createSchemaRegistry(config),
        },
        KafkaProducer,
      ],
      exports: [Kafka, SchemaRegistry, KafkaProducer, KAFKA_CONFIG],
    };
  }
}
