import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { EnvService } from '../env/env.service';

@Module({
  providers: [
    {
      provide: DynamoDBClient,
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        const endpoint = env.get('DYNAMODB_LOCAL_ENDPOINT');

        return new DynamoDBClient({
          region: env.get('AWS_REGION'),
          credentials: {
            accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
            secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
          },
          ...(endpoint && { endpoint }),
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
  ],
  exports: [DynamoDBDocumentClient],
})
export class DynamoDbModule implements OnApplicationShutdown {
  constructor(private readonly client: DynamoDBClient) {}

  onApplicationShutdown() {
    this.client.destroy();
  }
}
