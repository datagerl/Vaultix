"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import {
  acceptPartyInvitation,
  fetchPendingPartyInvitations,
  PendingPartyInvitation,
  rejectPartyInvitation,
} from "@/lib/escrow-api";
import { PartyAcceptanceModal } from "@/components/escrow/modals/PartyAcceptanceModal";
import { CanonicalEscrowStatus } from "@/utils/escrowStatus";

type InvitationAction = "accept" | "reject";

interface SelectedInvitation extends PendingPartyInvitation {
  action: InvitationAction;
}

interface PendingInvitationsProps {
  walletAddress: string | null;
}

export default function PendingInvitations({
  walletAddress,
}: PendingInvitationsProps) {
  const queryClient = useQueryClient();
  const [selectedInvitation, setSelectedInvitation] =
    useState<SelectedInvitation | null>(null);
  const invitationsQuery = useQuery({
    queryKey: ["pending-party-invitations", walletAddress],
    queryFn: fetchPendingPartyInvitations,
    enabled: Boolean(walletAddress),
  });

  const respondToInvitation = async (
    action: InvitationAction,
    escrowId: string,
    partyId: string,
  ) => {
    if (action === "accept") {
      await acceptPartyInvitation(escrowId, partyId);
    } else {
      await rejectPartyInvitation(escrowId, partyId);
    }

    await queryClient.invalidateQueries({
      queryKey: ["pending-party-invitations", walletAddress],
    });
    await queryClient.invalidateQueries({ queryKey: ["escrows"] });
  };

  return (
    <section
      aria-labelledby="pending-invitations-heading"
      className="mb-6 rounded-xl border border-amber-500/20 bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-amber-600" aria-hidden="true" />
        <h2
          id="pending-invitations-heading"
          className="text-xl font-bold text-foreground"
        >
          Pending invitations
        </h2>
      </div>

      {!walletAddress ? (
        <p className="text-sm text-muted-foreground">
          Connect and sign in with a wallet to see invitations addressed to
          you.
        </p>
      ) : invitationsQuery.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your invitations...
        </p>
      ) : invitationsQuery.isError ? (
        <div role="alert" className="text-sm text-destructive">
          <p>Could not load your invitations.</p>
          <button
            type="button"
            onClick={() => void invitationsQuery.refetch()}
            className="mt-2 font-medium underline"
          >
            Try again
          </button>
        </div>
      ) : invitationsQuery.data?.length ? (
        <ul className="space-y-3">
          {invitationsQuery.data.map(({ escrow, party }) => {
            const isCancelled =
              escrow.status === CanonicalEscrowStatus.CANCELLED;

            return (
              <li
                key={`${escrow.id}-${party.id}`}
                className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/escrow/${escrow.id}`}
                    className="font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    {escrow.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invited as {party.role.toLowerCase()} · {escrow.amount}{" "}
                    {escrow.asset}
                  </p>
                  {isCancelled && (
                    <p className="mt-1 text-sm text-destructive">
                      This escrow was cancelled; the invitation can no longer
                      be accepted or rejected.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {(["accept", "reject"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={isCancelled}
                      onClick={() =>
                        setSelectedInvitation({ escrow, party, action })
                      }
                      className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        action === "accept"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "border border-red-300 text-red-700 hover:bg-red-50"
                      }`}
                    >
                      {action === "accept" ? "Accept" : "Reject"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          You have no pending invitations.
        </p>
      )}

      {selectedInvitation && (
        <PartyAcceptanceModal
          key={`${selectedInvitation.escrow.id}-${selectedInvitation.party.id}-${selectedInvitation.action}`}
          isOpen
          onClose={() => setSelectedInvitation(null)}
          escrow={selectedInvitation.escrow}
          party={selectedInvitation.party}
          initialConfirmationType={selectedInvitation.action}
          onAccept={(escrowId, partyId) =>
            respondToInvitation("accept", escrowId, partyId)
          }
          onReject={(escrowId, partyId) =>
            respondToInvitation("reject", escrowId, partyId)
          }
        />
      )}
    </section>
  );
}
