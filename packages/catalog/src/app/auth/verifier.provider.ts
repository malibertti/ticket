import { ConfigService } from '@nestjs/config';
import {
  CognitoJwtVerifier,
  CognitoJwtVerifierSingleUserPool,
} from 'aws-jwt-verify/cognito-verifier';

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');

export interface AccessVerifier extends CognitoJwtVerifierSingleUserPool<{
  userPoolId: string;
  clientId: string;
  tokenUse: 'access';
}> {}

export const verifierProvider = {
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
};
