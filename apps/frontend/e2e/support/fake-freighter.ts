import type { Page } from '@playwright/test';

export interface FakeFreighterOptions {
  publicKey: string;
  /** Reject sign-message requests, e.g. to simulate the user declining sign-in. */
  rejectSignMessage?: boolean;
}

/**
 * Emulates the Freighter browser extension for `@stellar/freighter-api`.
 *
 * The library talks to the extension over `window.postMessage`: it posts
 * `{ source: 'FREIGHTER_EXTERNAL_MSG_REQUEST', messageId, type, ... }` and waits
 * for `{ source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId, ... }` (the
 * misspelt `messagedId` is the library's own). Answering those messages here
 * exercises the app's real wallet code path, with no extension installed.
 *
 * Signatures are fixed fakes; the mocked API accepts them.
 */
export async function installFakeFreighter(page: Page, options: FakeFreighterOptions): Promise<void> {
  await page.addInitScript(({ publicKey, rejectSignMessage }) => {
    // freighter-api short-circuits isConnected() when this global is truthy.
    (window as any).freighter = true;

    const fakeSignature = Array.from({ length: 64 }, (_, i) => (i % 256).toString(16).padStart(2, '0')).join('');

    const respond = (messagedId: unknown, body: Record<string, unknown>) =>
      window.postMessage({ source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId, ...body }, window.location.origin);

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (event.source !== window || data?.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') return;

      const id = data.messageId;
      switch (data.type) {
        case 'REQUEST_CONNECTION_STATUS':
          return respond(id, { isConnected: true });
        case 'REQUEST_ALLOWED_STATUS':
        case 'SET_ALLOWED_STATUS':
          return respond(id, { isAllowed: true });
        case 'REQUEST_ACCESS':
        case 'REQUEST_PUBLIC_KEY':
          return respond(id, { publicKey });
        case 'REQUEST_NETWORK':
          return respond(id, { network: 'TESTNET', networkPassphrase: 'Test SDF Network ; September 2015' });
        case 'REQUEST_NETWORK_DETAILS':
          return respond(id, {
            networkDetails: {
              network: 'TESTNET',
              networkName: 'Testnet',
              networkUrl: 'https://horizon-testnet.stellar.org',
              networkPassphrase: 'Test SDF Network ; September 2015',
            },
          });
        case 'SUBMIT_TRANSACTION':
          return respond(id, { signedTransaction: `${data.transactionXdr ?? 'xdr'}::signed-by-e2e`, signerAddress: publicKey });
        case 'SUBMIT_BLOB':
          return rejectSignMessage
            ? respond(id, { apiError: { code: -4, message: 'User declined access' } })
            : respond(id, { signedBlob: fakeSignature, signerAddress: publicKey });
        default:
          return undefined;
      }
    });
  }, { publicKey: options.publicKey, rejectSignMessage: options.rejectSignMessage ?? false });
}
