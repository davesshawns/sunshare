import React, { useState } from 'react';
import {
  Sun,
  PlusCircle,
  Clock,
  Battery,
  ShieldCheck,
  TrendingUp,
  Award,
  Zap,
} from 'lucide-react';
import { formatAddress, formatXlm } from '../lib/stellar.ts';

interface ProducerViewProps {
  offers: any[];
  wallet: string | null;
  profile: any;
  onCreateOffer: (offerData: any) => Promise<void>;
  loading: boolean;
}

export const ProducerView: React.FC<ProducerViewProps> = ({
  offers,
  wallet,
  profile,
  onCreateOffer,
  loading,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [totalCapacityKwh, setTotalCapacityKwh] = useState(100);
  const [pricePerKwhXlm, setPricePerKwhXlm] = useState(0.45);
  const [zoneId, setZoneId] = useState('ZONE_A');
  const [durationHours, setDurationHours] = useState(24);
  const [meterPubkey, setMeterPubkey] = useState(
    profile?.meter_pubkey || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [submitting, setSubmitting] = useState(false);

  // Filter offers published by current producer
  const producerOffers = offers.filter(
    (o) => wallet && o.producer_wallet.toLowerCase() === wallet.toLowerCase()
  );

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + durationHours * 3600 * 1000);
      const onChainId = Math.floor(Date.now() / 1000);

      await onCreateOffer({
        on_chain_offer_id: onChainId,
        total_capacity_kwh: totalCapacityKwh,
        price_per_kwh_xlm: pricePerKwhXlm,
        window_start: now.toISOString(),
        window_end: end.toISOString(),
        zone_id: zoneId,
        meter_pubkey: meterPubkey,
      });

      setShowCreateModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Producer Overview Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-400 flex items-center justify-center text-amber-400">
              <Sun className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">Solar Producer Portal</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Verified Producer
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Operator: {formatAddress(wallet)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Publish Energy Offer</span>
          </button>
        </div>

        {/* Live Producer Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> PV Capacity
            </span>
            <div className="text-xl font-black text-white font-mono mt-1">
              {profile?.solar_capacity_kw || 15} <span className="text-xs text-slate-400">kW</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Battery className="w-3.5 h-3.5 text-cyan-400" /> Battery Storage
            </span>
            <div className="text-xl font-black text-white font-mono mt-1">
              {profile?.battery_capacity_kwh || 24} <span className="text-xs text-slate-400">kWh</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-400" /> On-Chain Reputation
            </span>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              {profile?.reputation_score || 100}{' '}
              <span className="text-xs text-slate-400">/ 1000</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Delivered Energy
            </span>
            <div className="text-xl font-black text-amber-300 font-mono mt-1">
              {profile?.total_delivered_kwh || 0} <span className="text-xs text-slate-400">kWh</span>
            </div>
          </div>
        </div>
      </div>

      {/* Published Offers Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <span>Your Active Grid Offers</span>
        </h2>

        {producerOffers.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <p>You have not published any energy offers yet.</p>
            <p className="mt-1">Click "Publish Energy Offer" above to list your solar surplus on Stellar Testnet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Offer ID</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4">Available / Total</th>
                  <th className="py-3 px-4">Price (XLM/kWh)</th>
                  <th className="py-3 px-4">Delivery Window</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {producerOffers.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      #{o.on_chain_offer_id || o.id}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-400">{o.zone_id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-100">
                      {o.available_capacity_kwh} / {o.total_capacity_kwh} kWh
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {parseFloat(o.price_per_kwh_xlm).toFixed(3)} XLM
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(o.window_start).toLocaleDateString()} -{' '}
                      {new Date(o.window_end).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Publish Energy Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-400" />
              <span>Publish Solar Capacity Offer</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Create an on-chain offer allowing microgrid consumers to reserve clean solar power.
            </p>

            <form onSubmit={handleSubmitOffer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Total Capacity (kWh)</label>
                  <input
                    type="number"
                    min="5"
                    max="10000"
                    value={totalCapacityKwh}
                    onChange={(e) => setTotalCapacityKwh(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:border-amber-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Price (XLM per kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={pricePerKwhXlm}
                    onChange={(e) => setPricePerKwhXlm(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:border-amber-400 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Microgrid Zone</label>
                  <select
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-amber-400 outline-none"
                  >
                    <option value="ZONE_A">ZONE_A (North Residential)</option>
                    <option value="ZONE_B">ZONE_B (East Industrial)</option>
                    <option value="ZONE_SOLAR_1">ZONE_SOLAR_1 (Sunny Heights)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Window Duration</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-amber-400 outline-none"
                  >
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours (1 Day)</option>
                    <option value="48">48 Hours (2 Days)</option>
                    <option value="168">7 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Smart Meter Ed25519 Pubkey</label>
                <input
                  type="text"
                  value={meterPubkey}
                  onChange={(e) => setMeterPubkey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:border-amber-400 outline-none"
                  placeholder="32 bytes hex or G... Stellar key"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Cryptographic meter key used to sign verified delivery readings for this offer.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs flex justify-between">
                <span className="text-slate-400">Total Potential Revenue:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatXlm(totalCapacityKwh * pricePerKwhXlm)}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? 'Publishing...' : 'Publish to Stellar Grid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

