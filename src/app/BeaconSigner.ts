import { DAppClient } from '@airgap/beacon-sdk';
import { Signer } from '@polkadot/api/types';
import {
  SignerPayloadRaw,
  SignerResult,
} from '@polkadot/types/types/extrinsic';

export class BeaconSigner implements Signer {
  constructor(private readonly client: DAppClient) {}

  async signRaw(raw: SignerPayloadRaw): Promise<SignerResult> {
    const signature = await this.client.requestSignPayload({
      payload: raw.data,
    });

    return {
      id: 0,
      signature: signature.signature,
    };
  }
}
