import { context, type Context, propagation } from '@opentelemetry/api';

/** The active trace context in W3C form ({ traceparent }), or {} when nothing is being traced. */
export function currentTraceContext(): { traceparent?: string } {
  const carrier: { traceparent?: string } = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/** The trace context stored by currentTraceContext(), to continue that trace. */
export function traceContextFrom(carrier: { traceparent?: string }): Context {
  return propagation.extract(context.active(), carrier);
}
