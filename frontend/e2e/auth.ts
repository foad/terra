import type { Page } from "@playwright/test";

const COGNITO_REGION = "eu-west-2";

interface CognitoAuthResult {
  AccessToken: string;
  IdToken: string;
  RefreshToken: string;
  ExpiresIn: number;
  TokenType: "Bearer";
}

async function cognitoInitiateAuth(
  clientId: string,
  username: string,
  password: string,
): Promise<CognitoAuthResult> {
  const res = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  });
  if (!res.ok) {
    throw new Error(`Cognito InitiateAuth failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { AuthenticationResult?: CognitoAuthResult };
  if (!body.AuthenticationResult) {
    throw new Error(`Cognito InitiateAuth returned no AuthenticationResult: ${JSON.stringify(body)}`);
  }
  return body.AuthenticationResult;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
}

export async function signInAsAnalyst(page: Page): Promise<{ accessToken: string }> {
  const authority = process.env.VITE_COGNITO_AUTHORITY;
  const clientId = process.env.VITE_COGNITO_CLIENT_ID;
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!authority || !clientId || !username || !password) {
    throw new Error(
      "signInAsAnalyst: VITE_COGNITO_AUTHORITY, VITE_COGNITO_CLIENT_ID, E2E_USERNAME, E2E_PASSWORD all required",
    );
  }

  const tokens = await cognitoInitiateAuth(clientId, username, password);
  const profile = decodeJwtPayload(tokens.IdToken);
  const expires_at = Math.floor(Date.now() / 1000) + tokens.ExpiresIn;

  const user = {
    id_token: tokens.IdToken,
    access_token: tokens.AccessToken,
    refresh_token: tokens.RefreshToken,
    token_type: tokens.TokenType,
    scope: "email openid phone",
    profile,
    expires_at,
  };

  const storageKey = `oidc.user:${authority}:${clientId}`;
  const userJson = JSON.stringify(user);

  await page.addInitScript(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
    },
    { key: storageKey, value: userJson },
  );

  return { accessToken: tokens.AccessToken };
}
