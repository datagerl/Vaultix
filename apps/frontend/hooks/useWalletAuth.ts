import { useCallback, useState } from "react";
import { saveSession } from "@/lib/session";
import { apiClient } from "@/lib/api-client";
import {
  WalletConnection,
  WalletServiceFactory,
} from "@/app/services/wallet";

export interface WalletAuthState {
  loading: boolean;
  error: string | null;
  token: string | null;
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

      const { message } = await apiClient.post<{ message: string }>(
        "/auth/challenge",
        { walletAddress: publicKey },
      );
      if (!message) throw new Error("Failed to fetch sign-in challenge");

      const signature = await service.signMessage(message, publicKey);

      const { accessToken, refreshToken } = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/verify", { publicKey, signature });
      if (!accessToken || !refreshToken) {
        throw new Error("Authentication failed");
      }

      saveSession({ accessToken, refreshToken, walletAddress: publicKey });

      setState({ loading: false, error: null, token: accessToken });
      return true;
    } catch (err: unknown) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
        token: null,
      });
      return false;
    }
  }, []);

  return { ...state, signIn };
};
