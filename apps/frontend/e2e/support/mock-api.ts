import type { Page, Request, Route, WebSocketRoute } from '@playwright/test';

/**
 * Deterministic in-memory stand-in for the Vaultix backend and the third-party
 * services the frontend calls from the browser (Horizon, CoinGecko, the
 * Socket.IO gateway). Every test gets a fresh instance, so runs never depend
 * on a live backend, the Stellar network, or execution order.
 *
 * The frontend reaches the API through two clients:
 *  - `apiClient` / axios / auth: `${NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/v1/...`
 *  - `lib/escrow-api.ts`:         `${NEXT_PUBLIC_API_BASE_URL || ''}/api/v1/...` (same origin)
 * Both are routed here and share one store.
 */

export const BUYER = 'GAUKX7VPQ3UBKXI57UIRBRI3JJ2VYQVTXPDEQWEX7QZVKMID2KK7YB3Y';
export const SELLER = 'GDJWG2BDJFH7A7IVCMJYXNPFWRFIKSSEZAHN5GXVXYSMVEXEKDE7NVOT';

export type RawStatus = 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled';

export interface MockEscrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  status: RawStatus;
  type: string;
  creatorId: string;
  creatorAddress: string;
  counterpartyAddress: string;
  creator: { id: string; walletAddress: string };
  parties: Array<{ id: string; userId: string; role: string; status: string; createdAt: string; user?: { walletAddress: string } }>;
  conditions: unknown[];
  events: unknown[];
  isActive: boolean;
  deadline: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  stellarTxHash?: string;
  releaseTransactionHash?: string;
}

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

const NOW = '2026-10-01T12:00:00.000Z';
const FAR_FUTURE = '2030-01-01T00:00:00.000Z';

export function buildEscrow(overrides: Partial<MockEscrow> = {}): MockEscrow {
  const id = overrides.id ?? 'esc_e2e_0001';
  return {
    id,
    title: 'Website redesign',
    description: 'Redesign the marketing site and hand over Figma files.',
    amount: '250',
    asset: 'XLM',
    status: 'pending',
    type: 'standard',
    creatorId: 'user_buyer',
    creatorAddress: BUYER,
    counterpartyAddress: SELLER,
    creator: { id: 'user_buyer', walletAddress: BUYER },
    parties: [
      { id: 'party_buyer', userId: 'user_buyer', role: 'BUYER', status: 'ACCEPTED', createdAt: NOW, user: { walletAddress: BUYER } },
      { id: 'party_seller', userId: 'user_seller', role: 'SELLER', status: 'ACCEPTED', createdAt: NOW, user: { walletAddress: SELLER } },
    ],
    conditions: [],
    events: [],
    isActive: true,
    deadline: FAR_FUTURE,
    expiresAt: FAR_FUTURE,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** An unsigned JWT-shaped token; the frontend only decodes the payload. */
export function fakeAccessToken(walletAddress: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: `user_${walletAddress.slice(1, 7)}`, walletAddress, role: 'USER', exp: 4102444800 })}.e2e`;
}

export class MockApi {
  readonly escrows = new Map<string, MockEscrow>();
  readonly calls: RecordedCall[] = [];
  /** Requests no handler recognised. Mutations here fail the test (see fixtures). */
  readonly unhandled: RecordedCall[] = [];
  private nextId = 1;
  private socketOffline = false;
  private readonly sockets = new Set<WebSocketRoute>();

  constructor(private readonly appOrigin: string) {}

  /**
   * Simulates the real-time gateway going away (`true`: drop open sockets and
   * refuse reconnects) or coming back (`false`).
   */
  setSocketOffline(offline: boolean): void {
    this.socketOffline = offline;
    if (offline) {
      for (const ws of this.sockets) void ws.close();
      this.sockets.clear();
    }
  }

  seed(...escrows: MockEscrow[]): this {
    for (const escrow of escrows) this.escrows.set(escrow.id, structuredClone(escrow));
    return this;
  }

  get(id: string): MockEscrow | undefined {
    return this.escrows.get(id);
  }

  /** Calls whose method and path match, in order. */
  callsTo(method: string, path: string | RegExp): RecordedCall[] {
    return this.calls.filter(
      (c) => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path)),
    );
  }

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.hostname === 'localhost' && url.port === '3000' && url.pathname.startsWith('/v1/'),
      (route) => this.handle(route, 'api'),
    );
    await page.route(
      (url) => url.origin === this.appOrigin && url.pathname.startsWith('/api/'),
      (route) => this.handle(route, 'relative'),
    );
    await page.route(/api\.coingecko\.com/, (route) =>
      json(route, { stellar: { usd: 0.11, eur: 0.1, ngn: 170, kes: 14, ghs: 1.6, zar: 2 } }),
    );
    await page.route(/horizon(-testnet)?\.stellar\.org\/accounts\//, (route) =>
      json(route, { balances: [{ asset_type: 'native', balance: '10000.0000000' }] }),
    );
    await page.route(/horizon(-testnet)?\.stellar\.org\/transactions\//, (route) =>
      json(route, { hash: route.request().url().split('/').pop(), successful: true, ledger: 123456, created_at: NOW }),
    );
    await page.route(/cryptologos\.cc|raw\.githubusercontent\.com/, (route) => route.abort());

    // Socket.IO gateway: complete the engine.io handshake and accept the
    // `/events` namespace so the app reports a live connection.
    await page.routeWebSocket(/\/socket\.io\/.*EIO=4/, (ws) => {
      if (this.socketOffline) {
        ws.close();
        return;
      }
      this.sockets.add(ws);
      ws.onClose(() => this.sockets.delete(ws));
      // Engine.io OPEN packet ("0" + handshake JSON).
      ws.send(`0${JSON.stringify({ sid: 'e2e', upgrades: [], pingInterval: 300000, pingTimeout: 300000, maxPayload: 1000000 })}`);
      ws.onMessage((message) => {
        const text = String(message);
        if (text.startsWith('40')) {
          const namespace = text.match(/^40(\/[^,]*)?,?/)?.[1];
          ws.send(`40${namespace ? `${namespace},` : ''}${JSON.stringify({ sid: 'e2e-ns' })}`);
        } else if (text === '2') {
          ws.send('3');
        }
      });
    });
  }

  private async handle(route: Route, client: 'api' | 'relative'): Promise<void> {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: this.corsHeaders(request) });
    }

    const url = new URL(request.url());
    // Normalise both clients to a single `/v1/...` or `/escrows/...` space.
    const path = client === 'api' ? url.pathname.replace(/^\/v1/, '') : url.pathname.replace(/^\/api(\/v1)?/, '');
    const call: RecordedCall = { method: request.method(), path, body: parseBody(request) };
    this.calls.push(call);

    const result = this.dispatch(call, client);
    if (!result) {
      this.unhandled.push(call);
      return route.fulfill({
        status: 404,
        headers: { ...this.corsHeaders(request), 'content-type': 'application/json' },
        body: JSON.stringify({ message: `No E2E mock for ${call.method} ${path}` }),
      });
    }

    return route.fulfill({
      status: result.status ?? 200,
      headers: { ...this.corsHeaders(request), 'content-type': 'application/json' },
      body: result.body === undefined ? '' : JSON.stringify(result.body),
    });
  }

  private dispatch(call: RecordedCall, client: 'api' | 'relative'): { status?: number; body?: unknown } | null {
    const { method, path } = call;
    const body = (call.body ?? {}) as Record<string, any>;
    let m: RegExpMatchArray | null;

    // --- auth ---
    if (method === 'POST' && path === '/auth/challenge') {
      return { body: { nonce: 'e2e-nonce', message: `Sign in to Vaultix\nNonce: e2e-nonce\nWallet: ${body.walletAddress}` } };
    }
    if (method === 'POST' && path === '/auth/verify') {
      if (!/^[0-9a-f]{128}$/.test(body.signature ?? '')) {
        return { status: 400, body: { message: 'Signature must be hex-encoded' } };
      }
      return { body: { accessToken: fakeAccessToken(body.publicKey), refreshToken: 'e2e-refresh-token' } };
    }

    // --- global chrome (navbar, notifications, assets) ---
    if (method === 'GET' && path === '/notifications') return { body: [] };
    if (method === 'GET' && path === '/notifications/unread-count') return { body: 0 };
    if (method === 'GET' && path === '/notifications/preferences') return { body: [] };
    if (method === 'GET' && path === '/assets') return { body: [] };

    // --- escrow creation ---
    if (method === 'POST' && path === '/escrows/creation-intents') {
      return { body: { intentId: body.intentId, chainEscrowId: 'chain-e2e-1', unsignedXdr: 'AAAA-e2e-unsigned-xdr' } };
    }
    if (method === 'POST' && (m = path.match(/^\/escrows\/creation-intents\/([^/]+)\/submit$/))) {
      if (!String(body.signedXdr ?? '').includes('signed-by-e2e')) {
        return { status: 400, body: { message: 'Transaction was not signed by the wallet' } };
      }
      const intent = this.callsTo('POST', '/escrows/creation-intents').at(-1)?.body as Record<string, any>;
      const id = `esc_e2e_created_${this.nextId++}`;
      this.seed(
        buildEscrow({
          id,
          title: intent.title,
          description: intent.description,
          amount: intent.amount,
          asset: intent.asset,
          counterpartyAddress: intent.counterpartyAddress,
        }),
      );
      return { body: { status: 'confirmed', escrowId: id, transactionHash: `tx_create_${m[1]}` } };
    }

    // --- escrow reads ---
    if (method === 'GET' && path === '/escrows') {
      const escrows = [...this.escrows.values()];
      return { body: { escrows, hasNextPage: false, totalPages: 1, totalCount: escrows.length } };
    }
    if (method === 'GET' && (m = path.match(/^\/escrows\/[^/]*\/events$/))) {
      // apiClient's activity feed and lib/escrow-api's timeline expect different envelopes.
      return client === 'api'
        ? { body: { events: [], hasNextPage: false } }
        : { body: { data: [], total: 0, page: 1, limit: 100 } };
    }
    if (method === 'GET' && (m = path.match(/^\/escrows\/([^/]+)\/dispute\/timeline$/))) {
      return { body: { timeline: [] } };
    }
    if (method === 'GET' && (m = path.match(/^\/escrows\/([^/]+)\/dispute$/))) {
      const escrow = this.get(m[1]);
      if (!escrow || escrow.status !== 'disputed') return { status: 404, body: { message: 'No dispute' } };
      return {
        body: {
          id: 'dispute_e2e', escrowId: escrow.id, filedBy: BUYER, reason: 'DELIVERY_ISSUE', description: '',
          evidenceUrls: [], severity: 'HIGH', status: 'OPEN', createdAt: NOW, updatedAt: NOW,
        },
      };
    }
    if (method === 'GET' && (m = path.match(/^\/escrows\/([^/]+)$/))) {
      const escrow = this.get(m[1]);
      return escrow ? { body: escrow } : { status: 404, body: { message: '404: Escrow not found' } };
    }

    // --- escrow lifecycle (mirrors backend preconditions) ---
    if (method === 'POST' && (m = path.match(/^\/escrows\/([^/]+)\/fund$/))) {
      const escrow = this.get(m[1]);
      if (!escrow) return { status: 404, body: { message: 'Escrow not found' } };
      const extra = Object.keys(body).filter((k) => k !== 'amount');
      if (extra.length) return { status: 400, body: { message: `property ${extra[0]} should not exist` } };
      if (escrow.status !== 'pending') return { status: 400, body: { message: 'Escrow can only be funded while in pending status' } };
      if (Number(body.amount) !== Number(escrow.amount)) return { status: 400, body: { message: 'Amount must match the escrow amount' } };
      Object.assign(escrow, { status: 'active', stellarTxHash: 'tx_fund_e2e' });
      return { body: escrow };
    }
    if (method === 'POST' && (m = path.match(/^\/escrows\/([^/]+)\/release$/))) {
      const escrow = this.get(m[1]);
      if (!escrow) return { status: 404, body: { message: 'Escrow not found' } };
      if (escrow.status !== 'active') return { status: 400, body: { message: 'Escrow not active' } };
      Object.assign(escrow, { status: 'completed', releaseTransactionHash: 'tx_release_e2e' });
      return { body: { id: escrow.id, status: escrow.status, transactionHash: escrow.releaseTransactionHash } };
    }
    if (method === 'POST' && (m = path.match(/^\/escrows\/([^/]+)\/dispute$/))) {
      const escrow = this.get(m[1]);
      if (!escrow) return { status: 404, body: { message: 'Escrow not found' } };
      if (escrow.status !== 'active') return { status: 400, body: { message: 'Escrow is not active' } };
      escrow.status = 'disputed';
      return { status: 201, body: { id: 'dispute_e2e', escrowId: escrow.id, reason: body.reason, status: 'OPEN' } };
    }

    return null;
  }

  private corsHeaders(request: Request): Record<string, string> {
    return {
      'access-control-allow-origin': request.headers()['origin'] ?? this.appOrigin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    };
  }
}

function parseBody(request: Request): unknown {
  const raw = request.postData();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}
