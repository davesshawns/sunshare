import React, { useState } from 'react';
import { Wallet, Sun, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { connectFreighter } from '../lib/stellar.ts';

interface WalletModalProps {
  onClose: () => void;
  onConnectDemo: (role: 'producer' | 'consumer' | 'prosumer', customWallet?: string) => Promise<void>;
  onConnectFreighter: (address: string) => Promise<void>;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  onClose,
  onConnectDemo,
  onConnectFreighter,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFreighterConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const address = await connectFreighter();
      if (!address) {
        setError('Freighter extension connection was rejected or is not installed.');
        return;
      }
      await onConnectFreighter(address);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect Freighter');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = async (role: 'producer' | 'consumer' | 'prosumer') => {
    setLoading(true);
    try {
      await onConnectDemo(role);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Connect Stellar Wallet</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {/* Freighter Option */}
          <button
            onClick={handleFreighterConnect}
            disabled={loading}
            className="w-full p-4 rounded-xl border border-slate-800 hover:border-amber-500/50 bg-slate-950/60 hover:bg-slate-950 flex items-center justify-between group transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  Freighter Wallet
                </div>
                <div className="text-[11px] text-slate-400">
                  Connect via Stellar official browser extension
                </div>
              </div>
            </div>
            <span className="text-xs text-amber-400 font-semibold">Connect →</span>
          </button>

          {/* Sandbox Demo Accounts */}
          <div className="pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Or Instant Testnet Sandbox (No extension required)</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleDemoSelect('prosumer')}
                disabled={loading}
                className="w-full p-3 rounded-xl border border-slate-800 hover:border-amber-400/40 bg-slate-950/40 hover:bg-slate-950 text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">Prosumer (Solar + Consumer)</div>
                  <div className="text-[11px] text-slate-400">12.5 kW Solar Array + 10,000 XLM Sandbox Balance</div>
                </div>
                <span className="text-[11px] font-mono text-amber-400 font-semibold">Launch</span>
              </button>

              <button
                onClick={() => handleDemoSelect('producer')}
                disabled={loading}
                className="w-full p-3 rounded-xl border border-slate-800 hover:border-amber-400/40 bg-slate-950/40 hover:bg-slate-950 text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">Solar Producer</div>
                  <div className="text-[11px] text-slate-400">Publish energy offers & monitor smart meter earnings</div>
                </div>
                <span className="text-[11px] font-mono text-amber-400 font-semibold">Launch</span>
              </button>

              <button
                onClick={() => handleDemoSelect('consumer')}
                disabled={loading}
                className="w-full p-3 rounded-xl border border-slate-800 hover:border-amber-400/40 bg-slate-950/40 hover:bg-slate-950 text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">Clean Energy Consumer</div>
                  <div className="text-[11px] text-slate-400">Reserve solar capacity & lock payment escrow</div>
                </div>
                <span className="text-[11px] font-mono text-amber-400 font-semibold">Launch</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
