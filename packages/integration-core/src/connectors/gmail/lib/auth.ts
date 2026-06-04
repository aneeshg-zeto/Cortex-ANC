import {
  AppConnectionValueForAuthProperty,
  PieceAuth,
  Property,
} from '@cortex/integration-core/framework';
import { AppConnectionType } from '@cortex/integration-core/shared-stubs';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';

const gmailServiceAccountScopes = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

export const gmailScopes = [...gmailServiceAccountScopes, 'email'];

export const gmailAuth = [
  PieceAuth.OAuth2({
    description: '',
    authUrl: 'https://accounts.google.com/o/oauth2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    required: true,
    scope: gmailScopes,
  }),
  PieceAuth.CustomAuth({
    displayName: 'Service Account (Advanced)',
    description:
      'Authenticate via service account from https://console.cloud.google.com/ > IAM & Admin > Service Accounts > Create Service Account > Keys > Add key.  <br> <br> You can optionally use domain-wide delegation (https://support.google.com/a/answer/162106?hl=en#zippy=%2Cset-up-domain-wide-delegation-for-a-client) to access Gmail without adding the service account to each mailbox. <br> <br> **Note:** A user email with domain-wide delegation is required for Gmail service account access.',
    required: true,
    props: {
      serviceAccount: Property.LongText({
        displayName: 'Service Account JSON Key',
        required: true,
      }),
      userEmail: Property.ShortText({
        displayName: 'User Email',
        required: true,
        description:
          'Email address of the user to impersonate. Required for Gmail service account access via domain-wide delegation.',
      }),
    },
    validate: async ({ auth }) => {
      try {
        await getAccessToken({
          type: AppConnectionType.CUSTOM_AUTH,
          props: { ...auth },
        });
      } catch (e) {
        return {
          valid: false,
          error: (e as Error).message,
        };
      }
      return {
        valid: true,
      };
    },
  }),
];

export type GmailAuthValue = AppConnectionValueForAuthProperty<typeof gmailAuth>;

export async function createGoogleClient(auth: GmailAuthValue): Promise<OAuth2Client> {
  if (auth.type === AppConnectionType.CUSTOM_AUTH) {
    const props = auth.props as { serviceAccount: string; userEmail?: string };
    let serviceAccount: { client_email: string; private_key: string };
    try {
      serviceAccount = JSON.parse(props.serviceAccount) as {
        client_email: string;
        private_key: string;
      };
    } catch {
      throw new Error('Invalid Service Account JSON Key. Please provide a valid JSON string.');
    }
    return new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: gmailServiceAccountScopes,
      subject: props.userEmail?.trim() || undefined,
    });
  }
  const authClient = new OAuth2Client();
  const oauth = auth as { access_token?: string; refresh_token?: string };
  authClient.setCredentials(oauth);
  return authClient;
}

export const getAccessToken = async (auth: GmailAuthValue): Promise<string> => {
  if (auth.type === AppConnectionType.CUSTOM_AUTH) {
    const googleClient = await createGoogleClient(auth);
    const response = await googleClient.getAccessToken();
    if (response.token) {
      return response.token;
    } else {
      throw new Error('Could not retrieve access token from service account json');
    }
  }
  if (auth.type === AppConnectionType.OAUTH2) {
    return (auth as unknown as { access_token: string }).access_token;
  }
  throw new Error('Unsupported Gmail auth type');
};

export async function getUserEmail(
  auth: GmailAuthValue,
  authClient: OAuth2Client,
): Promise<string | undefined> {
  if (auth.type === AppConnectionType.CUSTOM_AUTH) {
    const props = auth.props as { userEmail?: string };
    return props.userEmail?.trim();
  }
  return (
    (await google.oauth2({ version: 'v2', auth: authClient }).userinfo.get()).data.email ??
    undefined
  );
}
