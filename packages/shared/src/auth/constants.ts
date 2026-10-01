import { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');

export interface AccessVerifier extends CognitoJwtVerifierSingleUserPool<{
  userPoolId: string;
  clientId: string;
  tokenUse: 'access';
}> {}
