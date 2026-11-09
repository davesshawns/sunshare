import React, { useState } from 'react';
import {
  Sun,
  Zap,
  Users,
  ShieldCheck,
  Wallet,
  Bell,
  Cpu,
  ChevronDown,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { formatAddress, formatXlm } from '../lib/stellar.ts';

interface NavbarProps {
  currentTab: 'consumer' | 'producer' | 'pools';
  onTabChange: (tab: 'consumer' | 'producer' | 'pools') => void;
  wallet: string | null;
  balanceXlm: string;
  isDemo: boolean;
  onOpenWalletModal: () => void;
  onOpenMeterSimulator: () => void;
  onDisconnect: () => void;
  notifications: any[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  wallet,
  balanceXlm,
  isDemo,
  onOpenWalletModal,
  onOpenMeterSimulator,
  onDisconnect,
  notifications,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      {/* Testnet Network Status Pill */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-mono text-amber-300 font-medium">Stellar Testnet Live</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">
            Soroban Smart Escrow & Cryptographic Meter Verification
          </span>
        </div>
        <div className="text-slate-400 font-mono text-[11px] flex items-center gap-3">
          <span>Fee: 0.00001 XLM</span>
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
            Native XLM Only
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
            <Sun className="w-6 h-6 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
                SUNSHARE
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                P2P Grid
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5">Peer-to-Peer Energy Exchange</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="hidden md:flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium">
          <button
            onClick={() => onTabChange('consumer')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
              currentTab === 'consumer'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Energy Market</span>
          </button>
          <button
            onClick={() => onTabChange('producer')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
              currentTab === 'producer'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Solar Producer</span>
          </button>
          <button
            onClick={() => onTabChange('pools')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
              currentTab === 'pools'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Community Pools</span>
          </button>
        </nav>

        {/* Right Tools & Wallet */}
        <div className="flex items-center gap-3">
          {/* Smart Meter Simulator Quick Button */}
          <button
            onClick={onOpenMeterSimulator}
            title="Open Ed25519 Smart Meter Simulator"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Meter Tool</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold rounded-full text-[10px] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
                  <span>Notifications</span>
                  <span className="text-amber-400">{notifications.length} events</span>
                </div>
                <div className="max-h-64 overflow-y-auto mt-2 space-y-2 text-xs">
                  {notifications.length === 0 ? (
                    <p className="text-slate-500 py-4 text-center">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 hover:border-slate-700"
                      >
                        <div className="font-medium text-slate-200">{n.title}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">{n.message}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">
                          {new Date(n.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wallet Status / Connect Button */}
          {wallet ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
              <div className="px-3 py-1 text-right">
                <div className="text-xs font-semibold text-amber-400 font-mono">
                  {formatXlm(balanceXlm)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 justify-end">
                  {isDemo && <span className="text-amber-500">[Demo]</span>}
                  <span>{formatAddress(wallet)}</span>
                </div>
              </div>
              <button
                onClick={onDisconnect}
                title="Disconnect"
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenWalletModal}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Stellar</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-slate-800/80 bg-slate-900/90 text-xs">
        <button
          onClick={() => onTabChange('consumer')}
          className={`flex-1 py-2.5 text-center font-medium ${
            currentTab === 'consumer' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'
          }`}
        >
          Marketplace
        </button>
        <button
          onClick={() => onTabChange('producer')}
          className={`flex-1 py-2.5 text-center font-medium ${
            currentTab === 'producer' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'
          }`}
        >
          Producer
        </button>
        <button
          onClick={() => onTabChange('pools')}
          className={`flex-1 py-2.5 text-center font-medium ${
            currentTab === 'pools' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'
          }`}
        >
          Pools
        </button>
      </div>
    </header>
  );
};

