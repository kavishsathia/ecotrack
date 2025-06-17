import { Issuer, custom } from 'openid-client';
import { singpassConfig } from './singpass-config';

let singpassClient: any = null;

export async function getSingpassClient() {
  if (singpassClient) return singpassClient;

  const singpassIssuer = await Issuer.discover(singpassConfig.ISSUER_URL);

  singpassClient = new singpassIssuer.Client(
    {
      client_id: singpassConfig.CLIENT_ID,
      response_types: ['code'],
      token_endpoint_auth_method: 'private_key_jwt',
      id_token_signed_response_alg: 'ES256',
      userinfo_encrypted_response_alg: singpassConfig.KEYS.PRIVATE_ENC_KEY.alg,
      userinfo_encrypted_response_enc: 'A256GCM',
      userinfo_signed_response_alg: singpassConfig.KEYS.PRIVATE_SIG_KEY.alg,
    },
    { keys: [singpassConfig.KEYS.PRIVATE_SIG_KEY, singpassConfig.KEYS.PRIVATE_ENC_KEY] }
  );

  custom.setHttpOptionsDefaults({
    timeout: 15000,
  });

  return singpassClient;
}