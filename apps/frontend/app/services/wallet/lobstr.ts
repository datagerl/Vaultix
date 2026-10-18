import { toHexSignature } from '@/lib/signature';

declare global {
  interface Window {
    lobstr?: {
      getPublicKey: () => Promise<string>;
      getNetwork?: () => Promise<unknown>;
      network?: string;
      signTransaction: (xdr: string) => Promise<unknown>;
      /** Not available in every Lobstr version; required for sign-in. */
      signMessage?: (message: string) => Promise<string | Uint8Array>;
    };
  }
}

export class LobstrService {
  private static instance: LobstrService;

  private constructor() {}

  public static getInstance(): LobstrService {
    if (!LobstrService.instance) {
      LobstrService.instance = new LobstrService();
    }
    return LobstrService.instance;
  }

  async isInstalled(): Promise<boolean> {
    try {
      if (typeof window === "undefined") return false;
      return !!window.lobstr;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    if (typeof window === "undefined" || !window.lobstr) {
      throw new Error("Lobstr wallet is not installed");
    }
    try {
      const publicKey = await window.lobstr.getPublicKey();
      return publicKey;
    } catch (error: any) {
      throw new Error(`Failed to connect to Lobstr: ${error.message}`);
    }
  }

  async getNetwork(): Promise<string> {
    if (typeof window === "undefined" || !window.lobstr) {
      throw new Error("Lobstr wallet is not installed");
    }
    const response = window.lobstr.getNetwork
      ? await window.lobstr.getNetwork()
      : window.lobstr.network;
    if (typeof response === "string") return response;
    if (typeof response === "object" && response !== null) {
      const network =
        (response as Record<string, unknown>).network ??
        (response as Record<string, unknown>).id;
      if (typeof network === "string") return network;
    }
    throw new Error("Lobstr did not report its active Stellar network.");
  }

  async signTransaction(xdr: string): Promise<string> {
    if (typeof window === "undefined" || !window.lobstr) {
      throw new Error("Lobstr wallet is not installed");
    }
    try {
      const response = await window.lobstr.signTransaction(xdr);
      if (typeof response === "string") return response;
      if (typeof response === "object" && response !== null) {
        const signedXdr =
          (response as Record<string, unknown>).signedXDR ??
          (response as Record<string, unknown>).signedTxXdr;
        if (typeof signedXdr === "string") return signedXdr;
      }
      throw new Error("Lobstr did not return a signed transaction.");
    } catch (error: any) {
      throw new Error(
        `Failed to sign transaction with Lobstr: ${error.message}`,
      );
    }
  }

  async signMessage(message: string): Promise<string> {
    if (typeof window === 'undefined' || !window.lobstr) {
      throw new Error('Lobstr wallet is not installed');
    }
    if (typeof window.lobstr.signMessage !== 'function') {
      throw new Error('This version of Lobstr does not support signing in. Please use Freighter or Albedo.');
    }
    try {
      return toHexSignature(await window.lobstr.signMessage(message));
    } catch (error: any) {
      throw new Error(`Failed to sign message with Lobstr: ${error.message}`);
    }
  }
}
