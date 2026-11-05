import crypto from 'node:crypto';
import { Keypair, StrKey, Horizon, Networks } from '@stellar/stellar-sdk';
import { config } from './config.js';

export const horizonServer = new Horizon.Server(config.stellar.horizonUrl);

/**
 * Generates a cryptographically secure hex nonce for challenges or meter readings.
 */
export function generateNonce(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Builds the canonical smart meter payload for delivery verification:
 * SHA256(reservation_id [8 bytes BE] || kwh_delivered [8 bytes BE] || meter_timestamp [8 bytes BE] || nonce [32 bytes])
 */
export function buildMeterPayloadHash(
  reservationId: bigint | number,
  kwhDelivered: bigint | number,
  meterTimestamp: bigint | number,
  nonceHex: string
): Buffer {
  const buf = Buffer.alloc(8 + 8 + 8 + 32);
  buf.writeBigUInt64BE(BigInt(reservationId), 0);
  buf.writeBigUInt64BE(BigInt(kwhDelivered), 8);
  buf.writeBigUInt64BE(BigInt(meterTimestamp), 16);

  const nonceBuf = Buffer.from(nonceHex, 'hex');
  if (nonceBuf.length !== 32) {
    throw new Error('Nonce must be exactly 32 bytes (64 hex characters)');
  }
  nonceBuf.copy(buf, 24);

  return crypto.createHash('sha256').update(buf).digest();
}

/**
 * Verifies an Ed25519 signature from a smart meter.
 * The public key and signature can be provided as hex strings or Stellar G... addresses.
 */
export function verifyMeterSignature(params: {
  reservationId: bigint | number;
  kwhDelivered: bigint | number;
  meterTimestamp: bigint | number;
  nonceHex: string;
  signatureHex: string;
  meterPubkey: string; // hex (32 bytes) or Stellar public key (G...)
}): boolean {
  try {
    const {
      reservationId,
      kwhDelivered,
      meterTimestamp,
      nonceHex,
      signatureHex,
      meterPubkey,
    } = params;

    const hash = buildMeterPayloadHash(
      reservationId,
      kwhDelivered,
      meterTimestamp,
      nonceHex
    );

    let keypair: Keypair;
    if (meterPubkey.startsWith('G') && meterPubkey.length === 56) {
      keypair = Keypair.fromPublicKey(meterPubkey);
    } else {
      const rawPub = Buffer.from(meterPubkey, 'hex');
      const strPub = StrKey.encodeEd25519PublicKey(rawPub);
      keypair = Keypair.fromPublicKey(strPub);
    }

    const sigBuf = Buffer.from(signatureHex, 'hex');
    return keypair.verify(hash, sigBuf);
  } catch (err) {
    console.error('Error verifying meter signature:', err);
    return false;
  }
}

/**
 * Verifies a Stellar wallet signature for authentication challenges.
 */
export function verifyWalletSignature(
  walletAddress: string,
  challengeMessage: string,
  signatureBase64OrHex: string
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
    const msgBuffer = Buffer.from(challengeMessage, 'utf8');

    let sigBuffer: Buffer;
    if (signatureBase64OrHex.length === 128) {
      sigBuffer = Buffer.from(signatureBase64OrHex, 'hex');
    } else {
      sigBuffer = Buffer.from(signatureBase64OrHex, 'base64');
    }

    return keypair.verify(msgBuffer, sigBuffer);
  } catch (err) {
    console.error('Error verifying wallet signature:', err);
    return false;
  }
}

/**
 * Fetches XLM balance for a wallet on Stellar Testnet.
 */
export async function getTestnetXlmBalance(walletAddress: string): Promise<string> {
  try {
    const account = await horizonServer.loadAccount(walletAddress);
    const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
    return nativeBalance ? nativeBalance.balance : '0.0000000';
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return '0.0000000 (Unfunded)';
    }
    return '0.0000000';
  }
}
