"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, LogOut, Copy, Check, AlertCircle } from "lucide-react";
import { useWalletConnection } from "@/app/hooks/useWallet";
import { useWallet } from "@/app/contexts/WalletContext";
import { ConnectWalletModal } from "./ConnectWalletModal";
import { truncateAddress } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { clearSession } from "@/lib/session";
import { safeReturnTo } from "@/lib/return-to";
import {
  getConfiguredStellarNetwork,
  isStellarNetworkMismatch,
} from "@/app/services/wallet/network";

export const WalletButton: React.FC = () => {
  const { isConnected: isWalletConnected, wallet, disconnect, network } =
    useWalletConnection();
  const { refreshNetwork } = useWallet();
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const targetNetwork = getConfiguredStellarNetwork();
  const networkMismatch = isStellarNetworkMismatch(network);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [isRefreshingNetwork, setIsRefreshingNetwork] = useState(false);

  const isConnected =
    isWalletConnected && !!wallet && session?.walletAddress === wallet.publicKey;

  const handleSignedIn = () => {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo || pathname === "/") {
      window.location.assign(safeReturnTo(returnTo));
    } else {
      router.refresh();
    }
  };

  const handleCopyAddress = () => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    clearSession();
    setShowDisconnect(false);
  };

  const handleRefreshNetwork = async () => {
    setIsRefreshingNetwork(true);
    try {
      await refreshNetwork();
    } finally {
      setIsRefreshingNetwork(false);
    }
  };

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="min-h-[44px] flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          type="button"
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          <span className="font-medium">
            {isWalletConnected ? "Sign In" : "Connect Wallet"}
          </span>
        </button>

        <ConnectWalletModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSignedIn={handleSignedIn}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center space-x-3">
        {networkMismatch && (
          <div
            role="alert"
            className="max-w-xs flex items-start gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-300">
              {network === "unknown"
                ? `Network unknown. Switch your wallet to ${targetNetwork ?? "the configured network"} and reconnect. Signing is blocked.`
                : `Wrong network. Switch your wallet to ${targetNetwork ?? "the configured network"} to sign transactions.`}
            </span>
            <button
              type="button"
              onClick={handleRefreshNetwork}
              disabled={isRefreshingNetwork}
              className="shrink-0 text-xs font-semibold text-red-200 underline disabled:opacity-50"
            >
              {isRefreshingNetwork ? "Checking…" : "Recheck"}
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-300">
            {wallet ? truncateAddress(wallet.publicKey) : "Wallet"}
          </span>
        </div>

        <button
          onClick={() => setShowDisconnect(!showDisconnect)}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Wallet menu"
          aria-expanded={showDisconnect}
          type="button"
        >
          <Wallet className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {showDisconnect && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
          <div className="p-4">
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Connected with</p>
              <p className="text-sm font-medium text-white capitalize">
                {wallet?.walletType}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-400">
                  {wallet ? truncateAddress(wallet.publicKey, 12) : ""}
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  type="button"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Network</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300 capitalize">
                  {wallet?.network ?? "unknown"}
                </p>
                {!networkMismatch ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">Correct</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-xs text-red-400">Wrong</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
              type="button"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Disconnect</span>
            </button>
          </div>
        </div>
      )}

      {showDisconnect && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDisconnect(false)}
        />
      )}
    </div>
  );
};

