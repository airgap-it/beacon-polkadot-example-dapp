import { Component } from '@angular/core';
import {
  web3Accounts,
  web3Enable,
  web3FromAddress,
} from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { DAppClient } from '@airgap/beacon-sdk';
import { BeaconSigner } from './BeaconSigner';
import { Signer } from '@polkadot/api/types';
import { Keyring } from '@polkadot/keyring';

const keyring = new Keyring();

///////////////////////////////////////////////////////////////////////////////////////////////
//
//
//  This project is a proof of concept for integrating https://walletbeacon.io with polkadot.js
//
//
///////////////////////////////////////////////////////////////////////////////////////////////

interface Network {
  name: string;
  value: string;
  prefix: number;
  url: string;
  disabled: boolean;
}

interface SignerObject {
  name: string;
  value: string;
  disabled: boolean;
  address: string;
  signer: Signer;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'beacon-polkadot-example-dapp';

  status: string = 'connecting...';

  address: string | undefined;

  recipient: string = '';
  amount: number = 0;

  networks: Network[] = [
    {
      name: 'Westend',
      value: 'westend',
      prefix: 42,
      url: 'wss://westend.api.onfinality.io/public-ws',
      disabled: false,
    },
    {
      name: 'Polkadot',
      value: 'dot',
      prefix: 0,
      url: 'wss://polkadot.api.onfinality.io/public-ws',
      disabled: false,
    },
    {
      name: 'Kusama',
      value: 'ksm',
      prefix: 2,
      url: 'wss://kusama.api.onfinality.io/public-ws',
      disabled: false,
    },
  ];
  activeNetwork: Network = this.networks[0];

  activeSigner: SignerObject | undefined;
  signers: SignerObject[] = [];

  private api: ApiPromise | undefined;

  private client: DAppClient;

  constructor() {
    this.client = new DAppClient({
      name: 'Polkadot Example',
      matrixNodes: ['beacon-node-1.sky.papers.tech'],
      iconUrl:
        'https://www.walletbeacon.io/wp-content/uploads/2021/03/beacon_logo-300x300.png',
      appUrl: 'https://airgap-it.github.io/beacon-polkadot-example-dapp/',
    });

    this.start();
  }

  async networkChanged(event: Event) {
    const value = (event.target as any).value;

    const network = this.networks.find((network) => network.value === value);

    if (network) {
      this.activeNetwork = network;
    }

    this.start();

    console.log('network', network);
  }

  async signerChanged(event: Event) {
    const value = (event.target as any).value;

    const signer = this.signers.find((signer) => signer.value === value);

    if (signer) {
      this.activeSigner = signer;
    }

    console.log('signer', signer);
  }

  async start() {
    this.status = 'connecting...';

    const wsProvider = new WsProvider(this.activeNetwork.url);
    this.api = await ApiPromise.create({ provider: wsProvider });
    web3Enable('beacon-example');

    this.status = 'connected';
    console.log(this.api.genesisHash.toHex());

    let activeAccount = await this.client.getActiveAccount();
    if (activeAccount) {
      const address = this.getAddressFromPublicKey(activeAccount.publicKey);

      const key = 'beacon';
      await this.addSigner(key, {
        name: 'Beacon',
        value: key,
        disabled: false,
        address: address,
        signer: new BeaconSigner(this.client),
      });
    }
  }

  async connectExtension() {
    const allAccounts = await web3Accounts();
    console.log('all', allAccounts);
    const extensionAccounts = allAccounts.filter(
      (account) => account.meta.source === 'polkadot-js'
    );
    if (extensionAccounts && extensionAccounts.length > 0) {
      console.log('polkadot-js', JSON.stringify(extensionAccounts, null, 2));
      this.address = extensionAccounts[0].address;
    } else {
      this.address = undefined;
    }

    if (!this.address) {
      return;
    }

    // finds an injector for an address
    const injector = await web3FromAddress(this.address);
    console.log('injector', injector);

    const key = 'extension';
    await this.addSigner(key, {
      name: 'Extension',
      value: 'extension',
      disabled: false,
      address: this.address,
      signer: injector.signer,
    });
  }

  async connectBeacon() {
    let activeAccount = await this.client.getActiveAccount();

    if (!activeAccount) {
      await this.client.requestPermissions();
      activeAccount = await this.client.getActiveAccount();
    }

    console.log('activeAccount', activeAccount);

    if (activeAccount) {
      this.address = this.getAddressFromPublicKey(activeAccount.publicKey);

      const key = 'beacon';
      await this.addSigner(key, {
        name: 'Beacon',
        value: key,
        disabled: false,
        address: this.address,
        signer: new BeaconSigner(this.client),
      });
    } else {
      this.address = undefined;
    }
  }

  async addSigner(key: string, signerObj: SignerObject) {
    if (!this.signers.some((signer) => signer.value === key)) {
      this.signers.push(signerObj);
      if (!this.activeSigner) {
        this.activeSigner = signerObj;
      }
    }
  }

  async disconnectBeacon() {
    await this.client.clearActiveAccount();
    this.address = undefined;
    this.signers = this.signers.filter((signer) => signer.value != 'beacon');
  }

  async sign() {
    if (!this.api) {
      console.error('this.api is not defined!');
      return;
    }
    if (!this.address) {
      console.error('this.address is not defined!');
      return;
    }

    if (!this.activeSigner) {
      console.error('this.activeSigner is not defined!');
      return;
    }
    const signerObj = this.activeSigner;

    this.api.tx.balances
      .transfer(this.recipient, this.amount)
      .signAndSend(
        signerObj.address,
        { signer: signerObj.signer },
        (status) => {
          console.log('DONE', status);
        }
      );
  }

  private getAddressFromPublicKey(publicKey: string) {
    return keyring.encodeAddress(
      new Uint8Array(Buffer.from(publicKey, 'hex')),
      this.activeNetwork.prefix
    );
  }
}
