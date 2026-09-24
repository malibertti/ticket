import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { Env } from '../env';

const REQUEST_ID = /^[\w-]{1,64}$/;

export function loggerConfigFactory(cs: ConfigService<Env, true>): Params {
  return {
    pinoHttp: {
      level: cs.get('LOG_LEVEL'),
      base: { service: 'catalog' },
      transport: cs.get('LOG_PRETTY')
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,

      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },

      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },

      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500
          ? 'error'
          : res.statusCode >= 400
            ? 'warn'
            : 'info',

      autoLogging: {
        ignore: (req) => req.url?.endsWith('/health') ?? false,
      },
    },
  };
}
