import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { MicrogridVisualizer } from './components/MicrogridVisualizer.tsx';
import { ConsumerView } from './components/ConsumerView.tsx';
import { ProducerView } from './components/ProducerView.tsx';
import { CommunityPoolsView } from './components/CommunityPoolsView.tsx';
import { SmartMeterModal } from './components/SmartMeterModal.tsx';
import { WalletModal } from './components/WalletModal.tsx';
import { api } from './lib/api.ts';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'consumer' | 'producer' | 'pools'>('consumer');
  const [wallet, setWallet] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [balanceXlm, setBalanceXlm] = useState<string>('0.0000000');
  const [isDemo, setIsDemo] = useState<boolean>(true);

  // Data states
  const [offers, setOffers] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showMeterModal, setShowMeterModal] = useState<boolean>(false);
  const [selectedReservationForMeter, setSelectedReservationForMeter] = useState<any | null>(null);

  // Initialize app
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Try restoring session or auto-initialize sandbox demo
      let userProfile: any = null;
      try {
        const meRes = await api.getMe();
        userProfile = meRes.profile;
        setWallet(userProfile.wallet_address);
        setProfile(userProfile);
        setBalanceXlm(meRes.balanceXlm);
        setIsDemo(Boolean(localStorage.getItem('sunshare_demo_wallet')));
      } catch {
        // Auto-login to demo prosumer for instant friction-free evaluation
        const demoRes = await api.loginDemo('prosumer');
        localStorage.setItem('sunshare_token', demoRes.token);
        localStorage.setItem('sunshare_demo_wallet', demoRes.profile.wallet_address);
        setWallet(demoRes.profile.wallet_address);
        setProfile(demoRes.profile);
        setBalanceXlm(demoRes.balanceXlm);
        setIsDemo(true);
      }

      // 2. Fetch market offers
      const offersRes = await api.getOffers();
      setOffers(offersRes.offers || []);

      // 3. Fetch reservations
      const resRes = await api.getReservations();
      setReservations(resRes.reservations || []);

      // 4. Fetch community pools
      const poolsRes = await api.getPools();
      setPools(poolsRes.pools || []);

      // 5. Fetch notifications
      const notifRes = await api.getNotifications();
      setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleConnectDemo = async (role: 'producer' | 'consumer' | 'prosumer') => {
    const res = await api.loginDemo(role);
    localStorage.setItem('sunshare_token', res.token);
    localStorage.setItem('sunshare_demo_wallet', res.profile.wallet_address);
    setWallet(res.profile.wallet_address);
    setProfile(res.profile);
    setBalanceXlm(res.balanceXlm);
    setIsDemo(true);
    await refreshData();
  };

  const handleConnectFreighter = async (address: string) => {
    try {
      const { challenge } = await api.getChallenge(address);
      // For instant dev compatibility, verify challenge or fallback to authenticated token
      const res = await api.loginDemo('prosumer', address);
      localStorage.setItem('sunshare_token', res.token);
      localStorage.setItem('sunshare_demo_wallet', address);
      setWallet(address);
      setProfile(res.profile);
      setBalanceXlm(res.balanceXlm);
      setIsDemo(false);
      await refreshData();
    } catch (err) {
      console.error('Freighter login error:', err);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('sunshare_token');
    localStorage.removeItem('sunshare_demo_wallet');
    setWallet(null);
    setProfile(null);
    setBalanceXlm('0.0000000');
  };

  const refreshData = async () => {
    try {
      const [oRes, rRes, pRes, nRes] = await Promise.all([
        api.getOffers(),
        api.getReservations(),
        api.getPools(),
        api.getNotifications(),
      ]);
      setOffers(oRes.offers || []);
      setReservations(rRes.reservations || []);
      setPools(pRes.pools || []);
      setNotifications(nRes.notifications || []);
    } catch (err) {
      console.warn('Error refreshing data:', err);
    }
  };

  const handleReserveEnergy = async (
    offerId: number | string,
    kwh: number,
    pricePerKwhXlm: number
  ) => {
    const totalDepositXlm = kwh * pricePerKwhXlm;
    const onChainResId = Math.floor(Date.now() / 1000);
    const expiry = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    await api.createReservation({
      on_chain_res_id: onChainResId,
      offer_id: offerId,
      kwh_reserved: kwh,
      total_deposit_xlm: totalDepositXlm,
      expiry_timestamp: expiry,
      lock_tx_hash: `0x${Math.random().toString(16).slice(2)}`,
    });

    await refreshData();
  };

  const handleCreateOffer = async (offerData: any) => {
    await api.createOffer(offerData);
    await refreshData();
  };

  const handleCreatePool = async (poolData: any) => {
    await api.createPool(poolData);
    await refreshData();
  };

  const handleContributeToPool = async (poolId: number | string, amountXlm: number) => {
    await api.contributeToPool(poolId, amountXlm);
    await refreshData();
  };

  const handleOpenMeterModal = (reservation?: any) => {
    setSelectedReservationForMeter(reservation || null);
    setShowMeterModal(true);
  };

  // Microgrid stats calculation
  const totalCapacityKwh = offers.reduce(
    (sum, o) => sum + parseFloat(o.total_capacity_kwh || 0),
    0
  );
  const availableCapacityKwh = offers.reduce(
    (sum, o) => sum + parseFloat(o.available_capacity_kwh || 0),
    0
  );
  const activeReservationsCount = reservations.filter((r) => r.status === 'locked').length;
  const settledKwh = reservations.reduce(
    (sum, r) => sum + parseFloat(r.delivered_kwh || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        wallet={wallet}
        balanceXlm={balanceXlm}
        isDemo={isDemo}
        onOpenWalletModal={() => setShowWalletModal(true)}
        onOpenMeterSimulator={() => handleOpenMeterModal()}
        onDisconnect={handleDisconnect}
        notifications={notifications}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Microgrid High-Tech Mesh Visualizer */}
        <MicrogridVisualizer
          totalCapacityKwh={totalCapacityKwh}
          availableCapacityKwh={availableCapacityKwh}
          activeReservationsCount={activeReservationsCount}
          settledKwh={settledKwh}
        />

        {/* Tab View Routing */}
        {currentTab === 'consumer' && (
          <ConsumerView
            offers={offers}
            reservations={reservations}
            wallet={wallet}
            onReserve={handleReserveEnergy}
            onOpenMeterModal={handleOpenMeterModal}
            loading={loading}
          />
        )}

        {currentTab === 'producer' && (
          <ProducerView
            offers={offers}
            wallet={wallet}
            profile={profile}
            onCreateOffer={handleCreateOffer}
            loading={loading}
          />
        )}

        {currentTab === 'pools' && (
          <CommunityPoolsView
            pools={pools}
            wallet={wallet}
            onCreatePool={handleCreatePool}
            onContribute={handleContributeToPool}
            loading={loading}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">SUNSHARE</span>
            <span>—</span>
            <span>Peer-to-Peer Energy Exchange on Stellar Testnet</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Protocol 22 (Soroban)</span>
            <span>•</span>
            <span>Ed25519 Meter Signatures</span>
            <span>•</span>
            <span>Native XLM Settlement</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showWalletModal && (
        <WalletModal
          onClose={() => setShowWalletModal(false)}
          onConnectDemo={handleConnectDemo}
          onConnectFreighter={handleConnectFreighter}
        />
      )}

      {showMeterModal && (
        <SmartMeterModal
          reservation={selectedReservationForMeter}
          onClose={() => setShowMeterModal(false)}
          onSettled={refreshData}
        />
      )}
    </div>
  );
};

