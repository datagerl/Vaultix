"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEscrow } from "@/hooks/useEscrow";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import { useWalletSession } from "@/hooks/useWalletSession";
import { fetchPendingPartyInvitations } from "@/lib/escrow-api";
import { EscrowService } from "@/services/escrow";
import { ConnectWalletModal } from "@/components/wallet/ConnectWalletModal";
import ReleaseFundsModal from "@/components/escrow/modals/ReleaseFundsModal";
import EscrowHeader from "@/components/escrow/detail/EscrowHeader";
import PartiesSection from "@/components/escrow/detail/PartiesSection";
import TermsSection from "@/components/escrow/detail/TermsSection";
import EscrowTimeline from "@/components/escrow/EscrowTimeline";
import ActivityFeed from "@/components/common/ActivityFeed";
import ConditionsList from "@/components/escrow/ConditionsList";
import { IParty } from "@/types/escrow";
import FileDisputeModal from "@/components/escrow/detail/file-dispute-modal";
import DisputeSection from "@/components/escrow/detail/DisputeSection";
import ArbitratorResolutionModal from "@/components/escrow/detail/ArbitratorResolutionModal";
import { EscrowDetailSkeleton } from "@/components/ui/EscrowDetailSkeleton";
import { CanonicalEscrowStatus } from '@/utils/escrowStatus';
import { apiClient } from "@/lib/api-client";

/** A party record may carry the wallet on a joined `user`, or use it as the id. */
const partyWallet = (party: IParty): string =>
  (party as IParty & { user?: { walletAddress?: string } }).user?.walletAddress ?? party.userId;

const EscrowDetailPage = () => {
  const { id } = useParams();
  const { escrow, error, loading, refetch, isLive } = useEscrow(id as string);
  // Actions are authorised by the signed-in wallet, not merely a connected one.
  const session = useSession();
  const publicKey = session?.walletAddress ?? null;
  const connected = !!publicKey;
  const { success: toastSuccess, error: toastError } = useToast();
  const { activePublicKey, canPerformProtectedActions } = useWalletSession();
  const pendingInvitationsQuery = useQuery({
    queryKey: ["pending-party-invitations", activePublicKey],
    queryFn: fetchPendingPartyInvitations,
    enabled: canPerformProtectedActions,
  });

  const [userRole, setUserRole] = useState<"creator" | "counterparty" | "arbitrator" | null>(null);
  const [currentParty, setCurrentParty] = useState<IParty | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [dispute, setDispute] = useState<any>(null);

  const handleFund = useCallback(async () => {
    if (!escrow) return;
    setIsFunding(true);
    try {
      await EscrowService.fundEscrow(escrow.id, {
        amount: String(escrow.amount),
        asset: escrow.asset,
      });
      toastSuccess("Escrow funded. The funds are now locked in escrow.");
      await refetch();
    } catch (err) {
      toastError(err instanceof Error && err.message ? err.message : "Failed to fund escrow. Please try again.");
    } finally {
      setIsFunding(false);
    }
  }, [escrow, refetch, toastError, toastSuccess]);

  useEffect(() => {
    if (escrow && publicKey) {
      const creatorWallet = escrow.creator?.walletAddress ?? escrow.creatorAddress;
      if (creatorWallet === publicKey || escrow.creatorId === publicKey) {
        setUserRole("creator");
        setCurrentParty(null);
      } else {
        const pendingParty = pendingInvitationsQuery.data?.find(
          (invitation) => invitation.escrow.id === escrow.id,
        )?.party;
        const walletParty = escrow.parties?.find(
          (party) => partyWallet(party) === publicKey,
        );
        const party = pendingParty ?? walletParty ?? null;
        if (party) {
          setUserRole("counterparty");
          setCurrentParty(party);
          return;
        }
        setUserRole(null);
        setCurrentParty(null);
      }
    } else {
      setUserRole(null);
      setCurrentParty(null);
    }
  }, [escrow, publicKey, pendingInvitationsQuery.data]);

  const fetchDisputeData = useCallback(async () => {
    if (escrow?.status !== CanonicalEscrowStatus.DISPUTED) {
      setDispute(null);
      return;
    }
    try {
      const disputeData = await apiClient.get(`/escrows/${escrow.id}/dispute`);
      setDispute(disputeData);
    } catch (error) {
      console.error("Error fetching dispute details:", error);
    }
  }, [escrow?.id, escrow?.status]);

  // Hook up dispute monitoring states
  useEffect(() => {
    void fetchDisputeData();
  }, [fetchDisputeData]);

  if (loading) return <EscrowDetailSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-destructive mb-3">Error Loading Escrow</h2>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-11 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">Escrow Not Found</h2>
          <p className="text-muted-foreground text-sm mb-4">The requested escrow agreement could not be found.</p>
          <Link
            href="/escrow"
            className="min-h-11 inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Back to Escrows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Visual Live Status Sync Badge Indicator */}
        <div className="flex justify-end mb-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            isLive 
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
              : "bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
            {isLive ? "LIVE SYNC ACTIVE" : "DISCONNECTED — POLLING MODE"}
          </div>
        </div>

        <EscrowHeader
          escrow={escrow}
          userRole={userRole}
          connected={connected}
          connect={() => setConnectOpen(true)}
          publicKey={publicKey}
          onFileDispute={() => setDisputeOpen(true)}
        />

        <div className="lg:hidden mt-4">
          <TermsSection
            escrow={escrow}
            userRole={userRole}
            onFund={handleFund}
            isFunding={isFunding}
            onRelease={() => setReleaseOpen(true)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {escrow.status === CanonicalEscrowStatus.DISPUTED && (
              <DisputeSection
                escrowId={escrow.id}
                escrowStatus={escrow.status}
                userRole={userRole}
                publicKey={publicKey}
                dispute={dispute}
                onDisputeUpdate={() => {
                  refetch();
                  void fetchDisputeData();
                }}
                onResolveDispute={() => setResolutionOpen(true)}
              />
            )}
            <PartiesSection
              escrow={escrow}
              currentParty={currentParty}
              onEscrowUpdated={refetch}
              userRole={userRole}
            />
            <ConditionsList
              escrowId={escrow.id}
              escrowStatus={escrow.status}
              conditions={escrow.conditions}
              currentParty={currentParty}
              onConditionsUpdated={refetch}
            />
            <EscrowTimeline
              escrowId={escrow.id}
              escrowStatus={escrow.status}
              hasConditions={(escrow.conditions?.length ?? 0) > 0}
              initialEvents={escrow.events}
            />
            <ActivityFeed escrowId={id as string} />
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <TermsSection
              escrow={escrow}
              userRole={userRole}
              onFund={handleFund}
              isFunding={isFunding}
              onRelease={() => setReleaseOpen(true)}
            />
          </div>
        </div>
      </div>

      <FileDisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        escrowId={escrow.id}
        userRole={userRole}
        escrowStatus={escrow.status}
        onDisputeUpdate={() => {
          refetch();
          void fetchDisputeData();
        }}
      />
      <ConnectWalletModal
        isOpen={connectOpen}
        onClose={() => setConnectOpen(false)}
        onSignedIn={() => void refetch()}
      />
      <ReleaseFundsModal
        isOpen={releaseOpen}
        onClose={() => {
          setReleaseOpen(false);
          void refetch();
        }}
        escrow={escrow}
        connected={connected}
        connect={() => setConnectOpen(true)}
        publicKey={publicKey}
      />
      <ArbitratorResolutionModal
        open={resolutionOpen}
        onClose={() => setResolutionOpen(false)}
        dispute={dispute}
        escrowAmount={escrow.amount}
        escrowAsset={escrow.asset}
        onResolutionComplete={() => {
          refetch();
          setResolutionOpen(false);
        }}
      />
    </div>
  );
};

export default EscrowDetailPage;