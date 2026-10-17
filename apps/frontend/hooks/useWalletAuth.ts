import { useCallback, useState } from "react";
import { saveSession } from "@/lib/session";
import {
  WalletConnection,
  WalletServiceFactory,
} from "@/app/services/wallet";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";
import { apiClient } from "@/lib/api-client";

export interface WalletAuthState {
  loading: boolean;
  error: string | null;
  token: string | null;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && typeof data.message === "string" && data.message) || fallback;
}

/**
 * Implements challenge-response wallet authentication:
 * 1. Fetch a challenge message from the backend.
 * 2. Sign it with the connected wallet.
 * 3. Submit the signature to receive a JWT bound to that wallet.
 *
 * On success the session is persisted (which also sets the `vaultix_token`
 * cookie the route middleware checks).
 */
export const useWalletAuth = () => {
  const [state, setState] = useState<WalletAuthState>({
    loading: false,
    error: null,
    token: null,
  });

  const signIn = useCallback(async (connection: WalletConnection): Promise<boolean> => {
    const { publicKey, walletType } = connection;
    setState({ loading: true, error: null, token: null });
    try {
      const service = WalletServiceFactory.getService(walletType);
      if (!service.signMessage) {
        throw new Error("This wallet does not support signing in.");
      }

      const challengeRes = await fetch(
        `${API_URL}${API_VERSION_PREFIX}/auth/challenge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: publicKey }),
        },
      );
      if (!challengeRes.ok) {
        throw new Error(await readErrorMessage(challengeRes, "Failed to fetch sign-in challenge"));
      }
      const { message } = await challengeRes.json();
      if (!message) throw new Error("Failed to fetch sign-in challenge");
      const { message } = await apiClient.post<{ message: string }>(
        "/auth/challenge",
        { walletAddress: publicKey },
      );

      const signature = await service.signMessage(message, publicKey);

      const verifyRes = await fetch(
        `${API_URL}${API_VERSION_PREFIX}/auth/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, signature }),
        },
      );
      if (!verifyRes.ok) {
        throw new Error(await readErrorMessage(verifyRes, "Authentication failed"));
      }
      const { accessToken, refreshToken } = await verifyRes.json();
      const { accessToken, refreshToken } = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/verify", {
        publicKey,
        signature: signedMessage,
      });
      if (!accessToken || !refreshToken) {
        throw new Error("Authentication failed");
      }

      saveSession({ accessToken, refreshToken, walletAddress: publicKey });

      setState({ loading: false, error: null, token: accessToken });
      return true;
    } catch (err: unknown) {
      setState({
        loading: false,
        error: err?.message ?? "Unknown error",
        error: err instanceof Error ? err.message : "Unknown error",
        token: null,
      });
      return false;
    }
  }, []);

  return { ...state, signIn };
};
