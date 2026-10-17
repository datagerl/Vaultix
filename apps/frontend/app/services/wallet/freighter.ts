/**
 * @file freighter.ts
 * @description Centralized Freighter wallet service leveraging the official `@stellar/freighter-api` package.
 */

import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  signTransaction as freighterSignTransaction,
  requestAccess as freighterRequestAccess,
  getNetwork as freighterGetNetwork,
  signMessage as freighterSignMessage,
} from "@stellar/freighter-api";
import { toHexSignature } from "@/lib/signature";

export interface FreighterWallet {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string, opts?: any) => Promise<string>;
  getNetwork: () => Promise<string>;
}

export class FreighterService {
  private static instance: FreighterService;

  private constructor() {}

  public static getInstance(): FreighterService {
    if (!FreighterService.instance) {
      FreighterService.instance = new FreighterService();
    }
    return FreighterService.instance;
  }

  async isInstalled(): Promise<boolean> {
    try {
      if (typeof window === "undefined") return false;
      const response = await freighterIsConnected();

      if (
        typeof response === "object" &&
        response !== null &&
        "isConnected" in response
      ) {
        return Boolean((response as any).isConnected);
      }
      return Boolean(response);
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    try {
      const connected = await this.isInstalled();
      if (!connected) {
        await freighterRequestAccess();
      }

      const response = await freighterGetAddress();
      let publicKey = "";

      if (
        typeof response === "object" &&
        response !== null &&
        "address" in response
      ) {
        publicKey = String((response as any).address || "");
      } else {
        publicKey = String(response || "");
      }

      if (!publicKey) {
        throw new Error("No public key returned from Freighter wallet.");
      }

      return publicKey;
    } catch (error: any) {
      throw new Error(
        `Failed to connect to Freighter: ${error.message || error}`,
      );
    }
  }

  async getNetwork(): Promise<string> {
    try {
      const response = await freighterGetNetwork();
      let networkStr = "";

      if (typeof response === "object" && response !== null) {
        networkStr = String(
          (response as any).network || (response as any).id || "",
        );
      } else {
        networkStr = String(response || "");
      }

      if (!networkStr) {
        throw new Error("Freighter did not report its active Stellar network.");
      }
      return networkStr;
    } catch (error) {
      throw new Error(
        `Failed to get network from Freighter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async signTransaction(xdr: string, publicKey?: string): Promise<string> {
    try {
      const network = await this.getNetwork();
      const addressResp = publicKey
        ? { address: publicKey }
        : await freighterGetAddress();
      let resolvedPublicKey = "";

      if (
        typeof addressResp === "object" &&
        addressResp !== null &&
        "address" in addressResp
      ) {
        resolvedPublicKey = String((addressResp as any).address || "");
      } else {
        resolvedPublicKey = String(addressResp || "");
      }

      const signedResponse = await freighterSignTransaction(xdr, {
        network: network.toUpperCase().includes("PUBLIC")
          ? "PUBLIC"
          : "TESTNET",
        accountToSign: resolvedPublicKey,
      } as any);

      if (
        typeof signedResponse === "object" &&
        signedResponse !== null &&
        "signedTxXdr" in signedResponse
      ) {
        return String((signedResponse as any).signedTxXdr);
      }
      return String(signedResponse);
    } catch (error: any) {
      throw new Error(`Failed to sign transaction: ${error.message || error}`);
    }
  }

  async signMessage(message: string, publicKey: string): Promise<string> {
    const response = await freighterSignMessage(message, { address: publicKey });
    if ((response as any)?.error) {
      throw new Error(
        `Failed to sign message: ${(response as any).error?.message ?? (response as any).error}`,
      );
    }
    return toHexSignature((response as any)?.signedMessage ?? response);
  }
}

