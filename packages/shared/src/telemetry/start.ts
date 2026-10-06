import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Starts OpenTelemetry: traces, metrics and logs over OTLP, configured by the standard OTEL_* env vars.
 * Must run before the app imports anything it should instrument (http, express, pg, aws-sdk, pino).
 * Does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */
export function startTelemetry(serviceName: string): void {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  const sdk = new NodeSDK({
    serviceName,
    instrumentations: [
      getNodeAutoInstrumentations({
        // very noisy, and not useful for these services
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // flush what's buffered before the process exits
  process.once('SIGTERM', () => {
    void sdk.shutdown();
  });
}
