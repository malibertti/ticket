import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { Valkey } from 'iovalkey';
import { EnvService } from '../env/env.service';
import { DbEventStore } from './db.event-store';
import { DbManifest } from './db.manifest';

@Module({
  providers: [
    {
      provide: DynamoDBClient,
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        const endpoint = env.get('DYNAMODB_LOCAL_ENDPOINT');

        return new DynamoDBClient({
          region: env.get('AWS_REGION'),
          ...(endpoint && {
            endpoint,
            credentials: {
              accessKeyId: env.get('AWS_ACCESS_KEY_ID') ?? 'local',
              secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY') ?? 'local',
            },
          }),
        });
      },
    },
    {
      provide: DynamoDBDocumentClient,
      inject: [DynamoDBClient],
      useFactory: (client: DynamoDBClient) =>
        DynamoDBDocumentClient.from(client, {
          marshallOptions: { removeUndefinedValues: true },
        }),
    },
    {
      provide: Valkey,
      inject: [EnvService],
      useFactory(env: EnvService) {
        return new Valkey(env.get('VALKEY_URL'));
      },
    },
    DbEventStore,
    DbManifest,
  ],
  exports: [DbEventStore, DbManifest],
})
export class DbModule implements OnApplicationShutdown {
  constructor(
    private readonly dynamoDb: DynamoDBClient,
    private readonly valkey: Valkey,
  ) {}

  async onApplicationShutdown() {
    this.dynamoDb.destroy();
    await this.valkey.quit();
  }
}
