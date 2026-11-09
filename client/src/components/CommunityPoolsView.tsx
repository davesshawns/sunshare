import React, { useState } from 'react';
import {
  Users,
  PlusCircle,
  BatteryCharging,
  Clock,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { formatAddress, formatXlm } from '../lib/stellar.ts';

interface CommunityPoolsViewProps {
  pools: any[];
  wallet: string | null;
  onCreatePool: (poolData: any) => Promise<void>;
  onContribute: (poolId: number | string, amountXlm: number) => Promise<void>;
  loading: boolean;
}

export const CommunityPoolsView: React.FC<CommunityPoolsViewProps> = ({
  pools,
  wallet,
  onCreatePool,
  onContribute,
  loading,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoolForContrib, setSelectedPoolForContrib] = useState<any | null>(null);
  const [contribAmountXlm, setContribAmountXlm] = useState(25);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetFundingXlm, setTargetFundingXlm] = useState(200);
  const [zoneId, setZoneId] = useState('ZONE_A');
  const [deadlineDays, setDeadlineDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const deadline = new Date(Date.now() + deadlineDays * 86400 * 1000).toISOString();
      const onChainPoolId = Math.floor(Date.now() / 1000);

      await onCreatePool({
        on_chain_pool_id: onChainPoolId,
        title,
        description,
        target_funding_xlm: targetFundingXlm,
        deadline,
        zone_id: zoneId,
      });

      setShowCreateModal(false);
      setTitle('');
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContributeSubmit = async () => {
    if (!selectedPoolForContrib) return;
    setSubmitting(true);
    try {
      await onContribute(selectedPoolForContrib.id, contribAmountXlm);
      setSelectedPoolForContrib(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400" />
              <span>Community Microgrid Pools</span>
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
              Joint Solar Funding
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Co-fund community solar arrays and shared neighborhood battery storage on Stellar.
            Escrow is automatically held in the Soroban smart contract until target goal is achieved.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Launch New Pool</span>
        </button>
      </div>

      {/* Pools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pools.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No community pools active yet</p>
            <p className="text-slate-400 text-xs mt-1">Be the first to propose a neighborhood clean energy project!</p>
          </div>
        ) : (
          pools.map((pool) => {
            const current = parseFloat(pool.current_funding_xlm);
            const target = parseFloat(pool.target_funding_xlm);
            const percent = Math.min(100, Math.round((current / target) * 100));
            const isGoalReached = pool.status === 'goal_reached' || percent >= 100;

            return (
              <div
                key={pool.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {pool.zone_id}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        isGoalReached
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {pool.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="my-4">
                    <h3 className="text-base font-bold text-white leading-snug">{pool.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {pool.description || 'Community funded renewable energy microgrid infrastructure.'}
                    </p>

                    {/* Funding Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                        <span className="text-amber-400 font-bold">{percent}% Funded</span>
                        <span>
                          {formatXlm(current)} / {formatXlm(target)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]">Proposed by:</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {formatAddress(pool.creator_wallet)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]">Contributors:</span>
                      <span className="font-mono text-[11px] text-slate-200">
                        {pool.contributor_count || 1} members
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]">Deadline:</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {new Date(pool.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPoolForContrib(pool)}
                  disabled={isGoalReached}
                  className={`mt-4 w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !isGoalReached
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                  }`}
                >
                  {!isGoalReached ? (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>Contribute XLM to Pool</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Target Goal Reached</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Contribute to Pool */}
      {selectedPoolForContrib && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>Contribute to Community Pool</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Project: <span className="text-white font-semibold">{selectedPoolForContrib.title}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Contribution Amount (XLM)</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setContribAmountXlm(amt)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                        contribAmountXlm === amt
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {amt} XLM
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={contribAmountXlm}
                  onChange={(e) => setContribAmountXlm(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:border-amber-400 outline-none"
                  placeholder="Custom XLM amount"
                  required
                />
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Smart Contract Escrow:</span>
                  <span className="font-mono text-slate-300">Soroban Testnet</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Refund Policy:</span>
                  <span className="text-emerald-400">100% Refundable if goal not met</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setSelectedPoolForContrib(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleContributeSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? 'Confirming...' : `Send ${contribAmountXlm} XLM`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Community Pool */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-amber-400" />
              <span>Create Community Clean Energy Pool</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Establish a community crowdfunding pool for neighborhood microgrid battery storage, solar canopies, or EV chargers.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Project Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Zone A 50kWh Microgrid Battery Backup"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Project Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the equipment, location, installation partner, and benefits to the microgrid members..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-amber-400 outline-none"
                  required
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Funding Target (XLM)</label>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={targetFundingXlm}
                    onChange={(e) => setTargetFundingXlm(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:border-amber-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Grid Zone</label>
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
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Funding Window Duration</label>
                <select
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-amber-400 outline-none"
                >
                  <option value="14">14 Days</option>
                  <option value="30">30 Days (1 Month)</option>
                  <option value="60">60 Days (2 Months)</option>
                </select>
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
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Deploy Pool to Stellar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

