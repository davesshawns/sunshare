import React from 'react';
import { Sun, BatteryCharging, ShieldCheck, Zap, Activity } from 'lucide-react';

interface MicrogridProps {
  totalCapacityKwh: number;
  availableCapacityKwh: number;
  activeReservationsCount: number;
  settledKwh: number;
}

export const MicrogridVisualizer: React.FC<MicrogridProps> = ({
  totalCapacityKwh,
  availableCapacityKwh,
  activeReservationsCount,
  settledKwh,
}) => {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
      {/* Background glow highlights */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left: Summary Metrics */}
        <div className="w-full lg:w-1/3 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Decentralized Microgrid Active</span>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Autonomous Solar Mesh
            </h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Energy packets routed directly between residential solar owners and local consumers.
              Payment escrow locked on Stellar Testnet and settled via Ed25519 meter readings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Total Mesh Power</span>
              <div className="text-lg font-bold font-mono text-amber-400">
                {totalCapacityKwh.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kWh</span>
              </div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Delivered & Settled</span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {settledKwh.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kWh</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right: Interactive Microgrid Diagram */}
        <div className="w-full lg:w-2/3 bg-slate-950/90 rounded-xl p-4 border border-slate-800/80 relative">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/60">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              ZONE_A (Residential Microgrid)
            </span>
            <span className="font-mono text-[11px] text-amber-400">
              {activeReservationsCount} Active Escrow Locks
            </span>
          </div>

          {/* Microgrid Nodes Diagram */}
          <div className="py-6 flex flex-col md:flex-row items-center justify-around gap-6 relative">
            {/* Producer Solar Node */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Sun className="w-8 h-8 animate-[spin_20s_linear_infinite]" />
              </div>
              <span className="text-xs font-bold text-slate-200 mt-2">Solar Producer</span>
              <span className="text-[11px] font-mono text-amber-400">{availableCapacityKwh} kWh avail</span>
              <span className="text-[10px] text-slate-400">PV Array: 15 kW</span>
            </div>

            {/* Connecting Flow Line 1 */}
            <div className="flex-1 w-full md:w-auto flex flex-col items-center justify-center">
              <div className="w-full h-1 bg-slate-800 relative overflow-hidden rounded-full">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-emerald-400 animate-[pulse_2s_infinite]"></div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-300 font-mono mt-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>P2P DC Flow</span>
              </div>
            </div>

            {/* Smart Meter Cryptographic Hub */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <span className="text-xs font-bold text-slate-200 mt-2">Ed25519 Meter</span>
              <span className="text-[11px] font-mono text-emerald-400">Cryptographically Signed</span>
              <span className="text-[10px] text-slate-400">SHA256 Delivery Proof</span>
            </div>

            {/* Connecting Flow Line 2 */}
            <div className="flex-1 w-full md:w-auto flex flex-col items-center justify-center">
              <div className="w-full h-1 bg-slate-800 relative overflow-hidden rounded-full">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 animate-[pulse_2s_infinite]"></div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono mt-1">
                <BatteryCharging className="w-3 h-3 text-cyan-400" />
                <span>Storage & Inverter</span>
              </div>
            </div>

            {/* Consumer Node */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <BatteryCharging className="w-8 h-8" />
              </div>
              <span className="text-xs font-bold text-slate-200 mt-2">Consumer Node</span>
              <span className="text-[11px] font-mono text-cyan-400">Escrow Locked</span>
              <span className="text-[10px] text-slate-400">EV & Home Load</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
            <span>Stellar Protocol 22 (Soroban)</span>
            <span>Deterministic Escrow Resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};

