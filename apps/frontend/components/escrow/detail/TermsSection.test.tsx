import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TermsSection from './TermsSection';
import { IEscrowExtended } from '@/types/escrow';
import { CanonicalEscrowStatus } from '@/utils/escrowStatus';

jest.mock('@/context/CurrencyContext', () => ({
  useCurrency: () => ({ showFiat: false, currency: 'usd' }),
}));
jest.mock('@/hooks/useFiatPrice', () => ({ useFiatPrice: () => ({ prices: {} }) }));

const escrow = (status: CanonicalEscrowStatus) =>
  ({
    id: 'esc_1',
    title: 'Logo design',
    description: 'd',
    amount: '100',
    asset: 'XLM',
    status,
    type: 'standard',
    creatorId: 'u1',
    creatorAddress: 'GBUYER',
    counterpartyAddress: 'GSELLER',
    deadline: '2030-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    isActive: true,
    creator: { id: 'u1', walletAddress: 'GBUYER' },
    parties: [],
    conditions: [],
    events: [],
  }) as IEscrowExtended;

describe('TermsSection actions', () => {
  it('lets the buyer fund a pending escrow', () => {
    const onFund = jest.fn();
    render(<TermsSection escrow={escrow(CanonicalEscrowStatus.CREATED)} userRole="creator" onFund={onFund} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fund Escrow' }));

    expect(onFund).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Release Funds' })).not.toBeInTheDocument();
  });

  it('disables funding while a funding request is in flight', () => {
    render(
      <TermsSection escrow={escrow(CanonicalEscrowStatus.CREATED)} userRole="creator" onFund={jest.fn()} isFunding />,
    );

    const button = screen.getByRole('button', { name: 'Funding…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it.each([CanonicalEscrowStatus.ACTIVE, CanonicalEscrowStatus.FUNDED])(
    'lets the buyer release a %s escrow',
    (status) => {
      const onRelease = jest.fn();
      render(<TermsSection escrow={escrow(status)} userRole="creator" onRelease={onRelease} />);

      fireEvent.click(screen.getByRole('button', { name: 'Release Funds' }));

      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Fund Escrow' })).not.toBeInTheDocument();
    },
  );

  it('never offers fund or release to the seller', () => {
    render(
      <TermsSection
        escrow={escrow(CanonicalEscrowStatus.ACTIVE)}
        userRole="counterparty"
        onFund={jest.fn()}
        onRelease={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Fund Escrow' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release Funds' })).not.toBeInTheDocument();
  });

  it.each([CanonicalEscrowStatus.COMPLETED, CanonicalEscrowStatus.DISPUTED])(
    'offers no buyer actions once the escrow is %s',
    (status) => {
      render(<TermsSection escrow={escrow(status)} userRole="creator" onFund={jest.fn()} onRelease={jest.fn()} />);

      expect(screen.queryByRole('button', { name: 'Fund Escrow' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Release Funds' })).not.toBeInTheDocument();
    },
  );
});
