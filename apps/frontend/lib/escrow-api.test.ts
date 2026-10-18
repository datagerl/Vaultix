import { fetchPendingPartyInvitations } from "./escrow-api";
import { apiClient } from "./api-client";
import { CanonicalEscrowStatus } from "@/utils/escrowStatus";

jest.mock("./api-client", () => ({
  apiClient: { request: jest.fn() },
}));

const request = apiClient.request as jest.Mock;

const invitationEscrow = (id: string, partyUserId: string) => ({
  id,
  title: `Escrow ${id}`,
  description: "Test escrow",
  amount: "25",
  asset: "XLM",
  creatorAddress: "GCREATOR",
  counterpartyAddress: "GWALLET",
  deadline: "2030-01-01",
  status: "pending" as const,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
  type: "STANDARD" as const,
  creatorId: "creator-id",
  isActive: true,
  creator: { id: "creator-id", walletAddress: "GCREATOR" },
  parties: [
    {
      id: `${id}-party`,
      userId: partyUserId,
      role: "SELLER",
      status: "pending",
      createdAt: "2025-01-01",
    },
  ],
  conditions: [],
  events: [],
});

describe("fetchPendingPartyInvitations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads authenticated pending invitations and normalizes the nested escrow", async () => {
    request.mockResolvedValue([
      {
        id: "escrow-invite-party",
        userId: "authenticated-user-id",
        role: "SELLER",
        status: "pending",
        createdAt: "2025-01-01",
        escrow: invitationEscrow("escrow-invite", "authenticated-user-id"),
      },
    ]);

    const invitations = await fetchPendingPartyInvitations();

    expect(invitations).toHaveLength(1);
    expect(invitations[0].escrow.id).toBe("escrow-invite");
    expect(invitations[0].party.id).toBe("escrow-invite-party");
    expect(invitations[0].party.status).toBe("pending");
    expect(invitations[0].escrow.status).toBe(CanonicalEscrowStatus.CREATED);
    expect(request).toHaveBeenCalledWith(
      "/escrows/pending-invitations",
      undefined,
    );
  });

  it("does not include non-pending party records", async () => {
    request.mockResolvedValue([
      {
        id: "escrow-invite-party",
        userId: "authenticated-user-id",
        role: "SELLER",
        status: "accepted",
        createdAt: "2025-01-01",
        escrow: invitationEscrow("escrow-invite", "authenticated-user-id"),
      },
    ]);

    await expect(fetchPendingPartyInvitations()).resolves.toEqual([]);
  });
});
