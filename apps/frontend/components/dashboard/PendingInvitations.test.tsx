import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PendingInvitations from "./PendingInvitations";
import {
  fetchPendingPartyInvitations,
  PendingPartyInvitation,
} from "@/lib/escrow-api";
import { CanonicalEscrowStatus } from "@/utils/escrowStatus";

jest.mock("@/lib/escrow-api", () => ({
  acceptPartyInvitation: jest.fn(),
  fetchPendingPartyInvitations: jest.fn(),
  rejectPartyInvitation: jest.fn(),
}));

const mockedFetchInvitations = jest.mocked(fetchPendingPartyInvitations);

const invitation: PendingPartyInvitation = {
  escrow: {
    id: "escrow-1",
    title: "Website redesign",
    description: "Design services",
    amount: "25",
    asset: "XLM",
    creatorAddress: "GCREATOR",
    counterpartyAddress: "GWALLET",
    deadline: "2030-01-01",
    status: CanonicalEscrowStatus.CREATED,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    type: "STANDARD" as const,
    creatorId: "creator-id",
    isActive: true,
    creator: { id: "creator-id", walletAddress: "GCREATOR" },
    parties: [],
    conditions: [],
    events: [],
  },
  party: {
    id: "party-1",
    userId: "GWALLET",
    role: "SELLER",
    status: "PENDING",
    createdAt: "2025-01-01",
  },
};

function renderPendingInvitations() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingInvitations walletAddress="GWALLET" />
    </QueryClientProvider>,
  );
}

describe("PendingInvitations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchInvitations.mockResolvedValue([invitation]);
  });

  it("shows pending invites for the active wallet with accept and reject actions", async () => {
    renderPendingInvitations();

    expect(await screen.findByText("Website redesign")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(mockedFetchInvitations).toHaveBeenCalledTimes(1);
  });

  it("opens the acceptance confirmation when the dashboard accept action is chosen", async () => {
    renderPendingInvitations();

    const acceptButton = await screen.findByRole("button", {
      name: "Accept",
    });
    fireEvent.click(acceptButton);

    expect(
      await screen.findByText("Confirm Acceptance", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  }, 10000);
});
