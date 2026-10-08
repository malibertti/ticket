import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import {
  DynamicModule,
  FactoryProvider,
  Module,
  Provider,
} from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { createKafka, KAFKA_CONFIG, KafkaConfig } from './config';
import { KafkaProducer } from './kafka.producer';

@Module({})
export class KafkaModule {
  // /**
  //  * Provides Kafka, SchemaRegistry and KafkaProducer;
  //  * import it where a service publishes or consumes. */
  // static forRoot(config: KafkaConfig): DynamicModule {
  //   return KafkaModule.build({
  //     provide: KAFKA_CONFIG,
  //     useValue: config,
  //   });
  // }

  /** Same, with the config built at startup (e.g. from the service's EnvService). */
  static forRootAsync(options: {
    inject: NonNullable<FactoryProvider['inject']>;
    useFactory: (...args: never[]) => KafkaConfig | Promise<KafkaConfig>;
  }): DynamicModule {
    return KafkaModule.build({
      provide: KAFKA_CONFIG,
      inject: options.inject,
      useFactory: options.useFactory,
    });
  }

  private static build(configProvider: Provider): DynamicModule {
    return {
      module: KafkaModule,
      global: true,
      providers: [
        configProvider,
        {
          provide: Kafka,
          inject: [KAFKA_CONFIG],
          useFactory(config: KafkaConfig): Kafka {
            return createKafka(config);
          },
        },
        {
          provide: SchemaRegistry,
          inject: [KAFKA_CONFIG],
          useFactory({ schemaRegistryUrl }: KafkaConfig) {
            return new SchemaRegistry({ host: schemaRegistryUrl });
          },
        },
        KafkaProducer,
      ],
      exports: [
        Kafka, //
        SchemaRegistry,
        KafkaProducer,
        // KAFKA_CONFIG,
      ],
    };
  }
}
