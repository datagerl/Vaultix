import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectWalletModal } from '../ConnectWalletModal';
import { useWallet } from '@/app/contexts/WalletContext';
import { useWalletAuth } from '@/hooks/useWalletAuth';

jest.mock('@/app/contexts/WalletContext', () => ({ useWallet: jest.fn() }));
jest.mock('@/hooks/useWalletAuth', () => ({ useWalletAuth: jest.fn() }));

const CONNECTION = { publicKey: 'GTEST', walletType: 'freighter', network: 'testnet' };

// Freighter is listed immediately but only becomes clickable once detected;
// Albedo is always 'Ready', so wait for both badges.
const waitForFreighter = () =>
  waitFor(() => expect(screen.getAllByText('Ready')).toHaveLength(2));

describe('ConnectWalletModal', () => {
  const onClose = jest.fn();
  const onSignedIn = jest.fn();
  const connect = jest.fn();
  const signIn = jest.fn();
  const getAvailableWallets = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockResolvedValue(CONNECTION);
    signIn.mockResolvedValue(true);
    getAvailableWallets.mockResolvedValue(['freighter']);
    (useWallet as jest.Mock).mockReturnValue({
      connect,
      getAvailableWallets,
      isConnecting: false,
      error: null,
    });
    (useWalletAuth as jest.Mock).mockReturnValue({ signIn, loading: false, error: null, token: null });
  });

  it('does not render while closed', () => {
    render(<ConnectWalletModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
  });

  it('shows supported wallets when open', async () => {
    render(<ConnectWalletModal isOpen onClose={onClose} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Freighter')).toBeInTheDocument());
  });

  it('connects, signs in with the connected wallet, then closes', async () => {
    render(<ConnectWalletModal isOpen onClose={onClose} onSignedIn={onSignedIn} />);
    await waitForFreighter();
    fireEvent.click(screen.getByText('Freighter'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(connect).toHaveBeenCalledWith('freighter');
    expect(signIn).toHaveBeenCalledWith(CONNECTION);
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open with an error when the sign-in challenge fails', async () => {
    signIn.mockResolvedValue(false);
    render(<ConnectWalletModal isOpen onClose={onClose} onSignedIn={onSignedIn} />);
    await waitForFreighter();
    fireEvent.click(screen.getByText('Freighter'));

    expect(await screen.findByText(/Sign-in failed/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('does not attempt sign-in when the wallet connection is rejected', async () => {
    connect.mockRejectedValue(new Error('User rejected the request'));
    render(<ConnectWalletModal isOpen onClose={onClose} />);
    await waitForFreighter();
    fireEvent.click(screen.getByText('Freighter'));

    expect(await screen.findByText('Connection request was cancelled by the user.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
