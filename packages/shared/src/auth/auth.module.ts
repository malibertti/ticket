import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AuthGuard } from './auth.guard';
import { JWT_VERIFIER } from './constants';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [
    {
      inject: [ConfigService],
      provide: JWT_VERIFIER,
      useFactory: async (cs: ConfigService) => {
        const verifier = CognitoJwtVerifier.create({
          userPoolId: cs.get('COGNITO_POOL_ID')!,
          clientId: cs.get('COGNITO_CLIENT_ID')!,
          tokenUse: 'access',
        });
        await verifier.hydrate();

        return verifier;
      },
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
