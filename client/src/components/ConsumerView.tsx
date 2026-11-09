import React, { useState } from 'react';
import {
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Lock,
  ArrowRight,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { formatAddress, formatXlm } from '../lib/stellar.ts';

interface ConsumerViewProps {
  offers: any[];
  reservations: any[];
  wallet: string | null;
  onReserve: (offerId: number | string, kwh: number, pricePerKwhXlm: number) => Promise<void>;
  onOpenMeterModal: (reservation: any) => void;
  loading: boolean;
}

export const ConsumerView: React.FC<ConsumerViewProps> = ({
  offers,
  reservations,
  wallet,
  onReserve,
  onOpenMeterModal,
  loading,
}) => {
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [kwhToReserve, setKwhToReserve] = useState<number>(20);
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);

  const filteredOffers = offers.filter((o) => {
    if (zoneFilter === 'all') return true;
    return o.zone_id === zoneFilter;
  });

  const handleOpenReserve = (offer: any) => {
    setSelectedOffer(offer);
    const initialKwh = Math.min(20, Math.floor(parseFloat(offer.available_capacity_kwh)));
    setKwhToReserve(initialKwh > 0 ? initialKwh : 1);
  };

  const handleConfirmReservation = async () => {
    if (!selectedOffer) return;
    setSubmitting(true);
    try {
      await onReserve(selectedOffer.id, kwhToReserve, parseFloat(selectedOffer.price_per_kwh_xlm));
      setSelectedOffer(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header and Zone Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            <span>P2P Energy Marketplace</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Buy clean solar power directly from neighboring producers at competitive rates.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 px-2 font-medium">Zone:</span>
          {['all', 'ZONE_A', 'ZONE_B', 'ZONE_SOLAR_1'].map((z) => (
            <button
              key={z}
              onClick={() => setZoneFilter(z)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                zoneFilter === z
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {z === 'all' ? 'All Zones' : z}
            </button>
          ))}
        </div>
      </div>

      {/* Energy Offers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOffers.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No energy offers available in this zone right now</p>
            <p className="text-slate-400 text-xs mt-1">Check back soon or switch to Solar Producer to publish capacity.</p>
          </div>
        ) : (
          filteredOffers.map((offer) => {
            const availKwh = parseFloat(offer.available_capacity_kwh);
            const totalKwh = parseFloat(offer.total_capacity_kwh);
            const priceXlm = parseFloat(offer.price_per_kwh_xlm);
            const percentAvail = Math.round((availKwh / totalKwh) * 100);

            return (
              <div
                key={offer.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {offer.zone_id}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatAddress(offer.producer_wallet)}
                    </span>
                  </div>

                  <div className="my-4">
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-black text-white font-mono">
                        {priceXlm.toFixed(3)}{' '}
                        <span className="text-xs font-sans text-amber-400 font-normal">XLM/kWh</span>
                      </div>
                      <div className="text-xs text-emerald-400 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>~30% grid savings</span>
                      </div>
                    </div>

                    {/* Capacity Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span>Available Capacity</span>
                        <span className="font-mono font-semibold text-slate-200">
                          {availKwh} / {totalKwh} kWh
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentAvail}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Window Details */}
                  <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" /> Window:
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {new Date(offer.window_start).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px]">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Producer Rep:
                      </span>
                      <span className="font-mono text-[11px] text-emerald-400 font-bold">
                        {offer.reputation_score || 100} / 1000
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenReserve(offer)}
                  disabled={availKwh <= 0}
                  className={`mt-4 w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    availKwh > 0
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{availKwh > 0 ? 'Reserve & Lock Escrow' : 'Sold Out'}</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Active Reservations Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <span>Your Energy Reservations & Settlements</span>
        </h2>

        {reservations.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            You have no active or previous reservations. Choose an offer above to reserve solar capacity.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Reservation ID</th>
                  <th className="py-3 px-4">Producer</th>
                  <th className="py-3 px-4">Reserved</th>
                  <th className="py-3 px-4">Deposit (XLM)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Delivered</th>
                  <th className="py-3 px-4 text-right">Smart Meter Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reservations.map((res) => {
                  const isLocked = res.status === 'locked';
                  const isDelivered = res.status === 'delivered';

                  return (
                    <tr key={res.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        #{res.on_chain_res_id || res.id}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {formatAddress(res.producer_wallet)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {res.kwh_reserved} kWh
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200">
                        {formatXlm(res.total_deposit_xlm)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            isDelivered
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isLocked
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400">
                        {res.delivered_kwh || 0} kWh
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isLocked ? (
                          <button
                            onClick={() => onOpenMeterModal(res)}
                            className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify Meter Reading</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Reserve Energy Dialog */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <span>Lock Energy Escrow</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Escrow funds will remain locked in the Stellar Soroban contract until delivery is cryptographically verified by the smart meter.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Energy Amount to Reserve (kWh)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={Math.floor(parseFloat(selectedOffer.available_capacity_kwh))}
                    value={kwhToReserve}
                    onChange={(e) => setKwhToReserve(parseInt(e.target.value, 10))}
                    className="flex-1 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-mono text-sm font-bold text-amber-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 w-20 text-center">
                    {kwhToReserve} kWh
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Price per kWh</span>
                  <span className="font-mono text-slate-200">
                    {parseFloat(selectedOffer.price_per_kwh_xlm).toFixed(3)} XLM
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Zone</span>
                  <span className="font-mono text-slate-200">{selectedOffer.zone_id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Network Gas Fee</span>
                  <span className="font-mono text-slate-200">0.00001 XLM</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                  <span className="text-white">Total Locked Escrow</span>
                  <span className="font-mono text-amber-400">
                    {formatXlm(kwhToReserve * parseFloat(selectedOffer.price_per_kwh_xlm))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setSelectedOffer(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReservation}
                disabled={submitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span>Locking Escrow...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Confirm & Lock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

