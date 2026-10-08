import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';
import { ITopicConfig, Kafka, logLevel } from 'kafkajs';

/**
 * Topic names must match TOPICS in @org/shared/kafka. Settings like cleanup.policy can only be
 * set at creation on MSK Serverless, so a change here means deleting and recreating the topic.
 */
const topics: ITopicConfig[] = [
  {
    topic: 'catalog.events.v1',
    numPartitions: 3,
    configEntries: [{ name: 'cleanup.policy', value: 'compact' }],
  },
  {
    topic: 'inventory.events.v1',
    numPartitions: 3, // delete policy, 7 days retention (MSK defaults)
  },
  {
    topic: '_schemas', // the schema registry's storage
    numPartitions: 1,
    configEntries: [{ name: 'cleanup.policy', value: 'compact' }],
  },
];

/** Runs on every deploy; creates only the topics that don't exist yet. */
export async function handler() {
  const region = process.env.AWS_REGION!;

  const admin = new Kafka({
    clientId: 'kafka-topics',
    brokers: process.env.KAFKA_BROKERS!.split(','),
    logLevel: logLevel.WARN,
    ssl: true,
    sasl: {
      mechanism: 'oauthbearer',
      oauthBearerProvider: () => iamToken(region),
    },
  }).admin();

  await admin.connect();

  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((t) => !existing.has(t.topic));

    if (missing.length) {
      await admin.createTopics({ topics: missing, waitForLeaders: true });
    }

    console.log(JSON.stringify({ created: missing.map((t) => t.topic) }));
  } finally {
    await admin.disconnect();
  }
}

async function iamToken(region: string) {
  const { token } = await generateAuthToken({ region });

  return { value: token };
}
