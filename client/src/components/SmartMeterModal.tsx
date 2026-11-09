import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Hash,
  Key,
  Clock,
  Zap,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { formatAddress, formatXlm } from '../lib/stellar.ts';

interface SmartMeterModalProps {
  reservation: any | null;
  onClose: () => void;
  onSettled: () => void;
}

export const SmartMeterModal: React.FC<SmartMeterModalProps> = ({
  reservation,
  onClose,
  onSettled,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [simulatedData, setSimulatedData] = useState<any | null>(null);
  const [kwhDelivered, setKwhDelivered] = useState<number>(
    reservation ? Math.round(parseFloat(reservation.kwh_reserved)) : 25
  );
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSimulatedPayload = async (kwh: number) => {
    setLoading(true);
    setError(null);
    try {
      const resId = reservation?.on_chain_res_id || reservation?.id || 101;
      const data = await api.simulateMeterPayload(resId, kwh);
      setSimulatedData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to simulate meter payload');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reservation) {
      const kwh = Math.round(parseFloat(reservation.kwh_reserved));
      setKwhDelivered(kwh);
      fetchSimulatedPayload(kwh);
    } else {
      fetchSimulatedPayload(25);
    }
  }, [reservation]);

  const handleKwhChange = (newKwh: number) => {
    setKwhDelivered(newKwh);
    fetchSimulatedPayload(newKwh);
  };

  const handleExecuteSettlement = async () => {
    if (!simulatedData || !reservation) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitMeterReading({
        reservation_id: reservation.id,
        kwh_delivered: simulatedData.kwh_delivered,
        meter_timestamp: simulatedData.meter_timestamp,
        nonce: simulatedData.nonce,
        signature: simulatedData.signature,
        meter_pubkey: simulatedData.meter_pubkey,
        is_simulated: true,
      });

      setResult(res);
      onSettled();
    } catch (err: any) {
      setError(err.message || 'Settlement verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8">
        {/* Header with Explicit Simulation Tag */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Smart Meter Verification Engine</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Simulated Hardware Tool
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ed25519 Cryptographic Proof of Delivery for Stellar Soroban
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Notice on Simulated vs Physical */}
        <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-400">Cryptographically Real Signatures:</span>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              While the electricity meter hardware is simulated for testing, the underlying Ed25519
              signature, SHA256 canonical hashing, and replay attack checks are cryptographically identical to physical smart meters on Stellar.
            </p>
          </div>
        </div>

        {reservation && (
          <div className="mt-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-xs grid grid-cols-3 gap-2 font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Reservation</span>
              <div className="font-bold text-slate-200">#{reservation.on_chain_res_id || reservation.id}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Reserved</span>
              <div className="font-bold text-amber-400">{reservation.kwh_reserved} kWh</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase">Locked Escrow</span>
              <div className="font-bold text-slate-200">{formatXlm(reservation.total_deposit_xlm)}</div>
            </div>
          </div>
        )}

        {/* Meter Controls & Payload Inspection */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span>Simulated Meter Delivery:</span>
              <span className="font-mono font-bold text-amber-400">{kwhDelivered} kWh Delivered</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max={reservation ? Math.round(parseFloat(reservation.kwh_reserved)) : 50}
                value={kwhDelivered}
                onChange={(e) => handleKwhChange(parseInt(e.target.value, 10))}
                className="flex-1 accent-amber-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => fetchSimulatedPayload(kwhDelivered)}
                disabled={loading}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>New Hash</span>
              </button>
            </div>
          </div>

          {/* Canonical Payload Inspection Box */}
          {simulatedData && (
            <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-sans font-semibold border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Canonical Payload (SHA256 Input)</span>
                <span className="text-emerald-400 font-mono text-[10px]">Valid Ed25519</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">Meter Public Key (32 bytes):</span>
                  <span className="text-slate-300 break-all">{simulatedData.meter_pubkey}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Replay Nonce (32 bytes):</span>
                  <span className="text-amber-400 break-all">{simulatedData.nonce}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Ed25519 Signature (64 bytes):</span>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 text-slate-300 break-all text-[10px]">
                  {simulatedData.signature}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                <Clock className="w-3 h-3" />
                <span>Timestamp: {simulatedData.meter_timestamp}</span>
              </div>
            </div>
          )}

          {/* Success or Error Feedback */}
          {result && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span>Cryptographic Proof Verified & Escrow Released!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-slate-300 pt-1">
                <div>Producer Payout: {formatXlm(result.settlement.payoutXlm)}</div>
                {result.settlement.refundXlm > 0 && (
                  <div>Consumer Leftover Refund: {formatXlm(result.settlement.refundXlm)}</div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          {reservation && reservation.status === 'locked' && !result && (
            <button
              onClick={handleExecuteSettlement}
              disabled={submitting || !simulatedData}
              className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
            >
              {submitting ? (
                <span>Verifying Cryptographic Proof...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Reading & Settle Escrow</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

