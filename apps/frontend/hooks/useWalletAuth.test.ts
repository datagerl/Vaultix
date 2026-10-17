import { act, renderHook } from '@testing-library/react';
import { useWalletAuth } from './useWalletAuth';
import { saveSession } from '@/lib/session';
import { WalletServiceFactory, WalletType } from '@/app/services/wallet';

jest.mock('@/lib/session', () => ({ saveSession: jest.fn() }));
jest.mock('@/app/services/wallet', () => ({
  WalletType: { FREIGHTER: 'freighter', ALBEDO: 'albedo', LOBSTR: 'lobstr' },
  WalletServiceFactory: { getService: jest.fn() },
}));

const PUBLIC_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const connection = { publicKey: PUBLIC_KEY, walletType: WalletType.FREIGHTER, network: 'testnet' };
const signMessage = jest.fn();

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  (WalletServiceFactory.getService as jest.Mock).mockReturnValue({ signMessage });
  signMessage.mockResolvedValue('ab'.repeat(64));
  global.fetch = jest.fn();
});

describe('useWalletAuth.signIn', () => {
  it('runs challenge -> wallet signature -> verify and persists the session', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ nonce: 'n', message: 'Sign in to Vaultix: n' }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'access', refreshToken: 'refresh' }));

    const { result } = renderHook(() => useWalletAuth());
    let ok = false;
    await act(async () => {
      ok = await result.current.signIn(connection);
    });

    expect(ok).toBe(true);
    const [challengeUrl, challengeInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(challengeUrl).toMatch(/\/v1\/auth\/challenge$/);
    expect(JSON.parse(challengeInit.body)).toEqual({ walletAddress: PUBLIC_KEY });

    expect(signMessage).toHaveBeenCalledWith('Sign in to Vaultix: n', PUBLIC_KEY);

    const [verifyUrl, verifyInit] = (global.fetch as jest.Mock).mock.calls[1];
    expect(verifyUrl).toMatch(/\/v1\/auth\/verify$/);
    expect(JSON.parse(verifyInit.body)).toEqual({ publicKey: PUBLIC_KEY, signature: 'ab'.repeat(64) });

    expect(saveSession).toHaveBeenCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
      walletAddress: PUBLIC_KEY,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.token).toBe('access');
  });

  it('surfaces the API error message and does not save a session when verify fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ message: 'm' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Invalid signature' }, false));

    const { result } = renderHook(() => useWalletAuth());
    let ok = true;
    await act(async () => {
      ok = await result.current.signIn(connection);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Invalid signature');
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('fails without calling the API when the wallet cannot sign messages', async () => {
    (WalletServiceFactory.getService as jest.Mock).mockReturnValue({});

    const { result } = renderHook(() => useWalletAuth());
    await act(async () => {
      await result.current.signIn(connection);
    });

    expect(result.current.error).toBe('This wallet does not support signing in.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports a rejected wallet signature', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ message: 'm' }));
    signMessage.mockRejectedValue(new Error('User rejected the request'));

    const { result } = renderHook(() => useWalletAuth());
    await act(async () => {
      await result.current.signIn(connection);
    });

    expect(result.current.error).toBe('User rejected the request');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(saveSession).not.toHaveBeenCalled();
  });
});
