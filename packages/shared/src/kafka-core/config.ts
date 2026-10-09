import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';
import { Kafka, logLevel } from 'kafkajs';

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  schemaRegistryUrl: string;
  /** Set to use IAM auth (MSK); unset for a local broker without auth. */
  awsRegion?: string;
}

/** One Kafka client setup for Nest apps and Lambdas: plain locally, IAM over TLS on MSK. */
export function createKafka({
  clientId,
  brokers,
  awsRegion,
}: Omit<KafkaConfig, 'schemaRegistryUrl'>): Kafka {
  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.WARN,
    retry: { initialRetryTime: 300, retries: 8 },
    ...(awsRegion
      ? {
          ssl: true,
          sasl: {
            mechanism: 'oauthbearer',
            oauthBearerProvider: () => iamToken(awsRegion),
          },
        }
      : {}),
  });
}

/** Signed token from the default AWS credentials (task role, Lambda role); kafkajs asks again before it expires. */
async function iamToken(region: string) {
  const { token } = await generateAuthToken({ region });

  return { value: token };
}
