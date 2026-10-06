import { Logger, LogLevel } from '@nestjs/common';

interface LogMethodOptions {
  logArgs?: boolean;
  logResult?: boolean;
  level?: LogLevel;
}

export function LogMethod(options: LogMethodOptions = {}): MethodDecorator {
  const { logArgs = true, logResult = true, level = 'verbose' } = options;

  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    const className = target.constructor.name;
    const method = String(propertyKey);
    const logger = new Logger(className);

    descriptor.value = function (...args: unknown[]) {
      const start = process.hrtime.bigint();
      const elapsedMs = () => Number(process.hrtime.bigint() - start) / 1e6;

      logger[level]({ method, ...(logArgs && { args }) }, `${method} started`);

      const onSuccess = (result: unknown) => {
        logger[level](
          { method, durationMs: elapsedMs(), ...(logResult && { result }) },
          `${method} completed`,
        );
        return result;
      };

      const onError = (err: unknown) => {
        logger[level](
          { method, durationMs: elapsedMs(), err },
          `${method} failed`,
        );
        throw err;
      };

      try {
        const result = original.apply(this, args);
        // handle async methods
        if (result instanceof Promise) {
          return result.then(onSuccess, onError);
        }
        return onSuccess(result);
      } catch (err) {
        return onError(err);
      }
    };

    // preserve metadata (guards, interceptors, swagger, etc.)
    Reflect.getMetadataKeys(original).forEach((key) => {
      Reflect.defineMetadata(
        key,
        Reflect.getMetadata(key, original),
        descriptor.value,
      );
    });

    return descriptor;
  };
}
