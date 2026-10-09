import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

@Module({})
export class LoggerModule {
  static forRoot(service: string): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory(cs: ConfigService) {
            const requestId = /^[\w-]{1,64}$/;

            return {
              pinoHttp: {
                level: cs.get('LOG_LEVEL'),
                base: { service },
                transport: cs.get('LOG_PRETTY')
                  ? {
                      target: 'pino-pretty',
                      options: {
                        singleLine: true,
                        colorize: true,
                        customColors: 'trace:yellow,info:gray',
                        useOnlyCustomProps: false,
                      },
                    }
                  : undefined,

                genReqId: (req, res) => {
                  const incoming = req.headers['x-request-id'];
                  const id =
                    typeof incoming === 'string' && requestId.test(incoming)
                      ? incoming
                      : randomUUID();
                  res.setHeader('x-request-id', id);
                  return id;
                },

                serializers: {
                  req: (req) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                  }),
                  res: (res) => ({ statusCode: res.statusCode }),
                },

                customLogLevel: (_req, res, err) =>
                  err || res.statusCode >= 500
                    ? 'error'
                    : res.statusCode >= 400
                      ? 'warn'
                      : 'info',

                autoLogging: {
                  // ignore: (req) => req.url?.endsWith('/health') ?? false,
                },
              },
            };
          },
        }),
      ],
    };
  }
}
