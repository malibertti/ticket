import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnManagedLoginBranding,
  IUserPool,
  IUserPoolClient,
  ManagedLoginVersion,
  OAuthScope,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthStackProps extends StackProps {
  adminDomain: string;
}

export class AuthStack extends Stack {
  readonly userPool: IUserPool;
  readonly userPoolClient: IUserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
    });

    this.userPool.addGroup('Admins', { groupName: 'admins' });
    this.userPool.addGroup('Managers', { groupName: 'managers' });

    this.userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: { userSrp: false },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.EMAIL, OAuthScope.OPENID],
        callbackUrls: [
          `https://${props.adminDomain}/`,
          'http://localhost:4200/',
        ],
        logoutUrls: [`https://${props.adminDomain}/`, 'http://localhost:4200/'],
      },
    });

    new CfnManagedLoginBranding(this, 'Branding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.userPoolClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    const domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: 'mattrc-ticketing-admin' },
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    new CfnOutput(this, 'AuthDomain', {
      value: domain.baseUrl(),
    });

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, 'Authority', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
    });
  }
}
