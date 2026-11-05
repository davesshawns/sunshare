import freighter from '@stellar/freighter-api';

export const STELLAR_TESTNET_NETWORK = 'Test SDF Network ; September 2015';
export const STELLAR_TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
export const STELLAR_TESTNET_EXPLORER = 'https://stellar.expert/explorer/testnet';
export const STROOPS_PER_XLM = 10_000_000;

export interface ConnectedWallet {
  address: string;
  isDemo: boolean;
  network?: string;
}

/**
 * Checks if Freighter browser extension is installed and available
 */
export async function isFreighterAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const connected = await freighter.isConnected();
    return Boolean(connected);
  } catch {
    return false;
  }
}

/**
 * Requests connection to Freighter wallet on Stellar Testnet
 */
export async function connectFreighter(): Promise<string | null> {
  try {
    const access = await freighter.requestAccess();
    if (access?.address) {
      return access.address;
    }
    const addressObj = await freighter.getAddress();
    return addressObj?.address || null;
  } catch (err) {
    console.warn('Freighter connection rejected or unavailable:', err);
    return null;
  }
}

/**
 * Signs a message challenge using Freighter wallet
 */
export async function signFreighterChallenge(message: string): Promise<string | null> {
  try {
    const result = await freighter.signMessage(message);
    return result?.signedMessage || null;
  } catch (err) {
    console.warn('Freighter message signature failed:', err);
    return null;
  }
}

/**
 * Shortens a Stellar public address for clean UI display (e.g., GABC...WXYZ)
 */
export function formatAddress(address?: string | null): string {
  if (!address) return '';
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Formats XLM number with fixed 2 to 4 decimals
 */
export function formatXlm(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00 XLM';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00 XLM';
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} XLM`;
}

/**
 * Returns Stellar.Expert testnet explorer links
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${STELLAR_TESTNET_EXPLORER}/tx/${txHash}`;
}

export function getExplorerAccountUrl(address: string): string {
  return `${STELLAR_TESTNET_EXPLORER}/account/${address}`;
}

export function getExplorerContractUrl(contractId: string): string {
  return `${STELLAR_TESTNET_EXPLORER}/contract/${contractId}`;
}
