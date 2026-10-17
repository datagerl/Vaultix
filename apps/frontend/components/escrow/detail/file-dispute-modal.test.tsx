import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileDisputeModal from './file-dispute-modal';
import { fileDispute } from '@/lib/escrow-api';

jest.mock('@/lib/escrow-api', () => ({ fileDispute: jest.fn() }));
// Evidence upload talks to the API on its own; it is not part of this flow.
jest.mock('./DisputeEvidenceUpload', () => ({ DisputeEvidenceUpload: () => null }));

const success = jest.fn();
const error = jest.fn();
const warning = jest.fn();
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ success, error, warning }) }));

function renderModal(props: Partial<React.ComponentProps<typeof FileDisputeModal>> = {}) {
  const onClose = jest.fn();
  const onDisputeUpdate = jest.fn();
  render(
    <FileDisputeModal
      open
      onClose={onClose}
      escrowId="esc_1"
      userRole="creator"
      escrowStatus="active"
      onDisputeUpdate={onDisputeUpdate}
      {...props}
    />,
  );
  return { onClose, onDisputeUpdate };
}

async function fillAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Select reason'));
  await user.click(screen.getByText('Delivery Issue'));
  await user.click(screen.getByText('Select severity'));
  await user.click(screen.getByText('High - Critical Issue'));
  await user.type(
    screen.getByPlaceholderText('Provide detailed explanation of the issue...'),
    'Nothing was delivered by the deadline.',
  );
  await user.click(screen.getByRole('button', { name: 'Submit Dispute' }));
  await user.click(await screen.findByRole('button', { name: 'Confirm & File Dispute' }));
}

beforeEach(() => jest.clearAllMocks());

describe('FileDisputeModal', () => {
  it('requires reason, severity and description before submitting', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Submit Dispute' })).toBeDisabled();
  });

  it('files the dispute after confirmation and notifies the page', async () => {
    (fileDispute as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup();
    const { onClose, onDisputeUpdate } = renderModal();

    await fillAndConfirm(user);

    expect(fileDispute).toHaveBeenCalledWith('esc_1', { reason: 'DELIVERY_ISSUE', evidence: undefined });
    expect(success).toHaveBeenCalledWith(expect.stringMatching(/Dispute filed successfully/));
    expect(onDisputeUpdate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the API error instead of crashing when filing fails', async () => {
    (fileDispute as jest.Mock).mockRejectedValue(new Error('Escrow is not active'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { onDisputeUpdate } = renderModal();

    await fillAndConfirm(user);

    expect(error).toHaveBeenCalledWith('Escrow is not active');
    expect(onDisputeUpdate).not.toHaveBeenCalled();
  });

  it('explains why a non-party cannot file a dispute', () => {
    renderModal({ userRole: null });
    expect(screen.getByText(/You cannot file a dispute on this escrow/)).toBeInTheDocument();
  });
});
