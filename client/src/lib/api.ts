const API_BASE = '';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('sunshare_token');
  const demoWallet = localStorage.getItem('sunshare_demo_wallet');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (demoWallet) {
    headers['x-demo-wallet'] = demoWallet;
  }
  return headers;
}

export const api = {
  // Auth
  async getChallenge(wallet: string) {
    const res = await fetch(`${API_BASE}/api/auth/challenge?wallet=${wallet}`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to get challenge');
    return res.json();
  },

  async verifyChallenge(wallet: string, challenge: string, signature: string) {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, challenge, signature }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Verification failed');
    return res.json();
  },

  async loginDemo(role: 'producer' | 'consumer' | 'prosumer' = 'prosumer', wallet?: string) {
    const res = await fetch(`${API_BASE}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, wallet }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Demo login failed');
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  // Profiles
  async getProfile(wallet: string) {
    const res = await fetch(`${API_BASE}/api/profiles/${wallet}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  async updateProfile(data: any) {
    const res = await fetch(`${API_BASE}/api/profiles/me`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update profile');
    return res.json();
  },

  // Offers
  async getOffers(params?: { zone?: string; status?: string; producer?: string }) {
    const q = new URLSearchParams();
    if (params?.zone) q.set('zone', params.zone);
    if (params?.status) q.set('status', params.status);
    if (params?.producer) q.set('producer', params.producer);

    const res = await fetch(`${API_BASE}/api/offers?${q.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch offers');
    return res.json();
  },

  async getOffer(id: string | number) {
    const res = await fetch(`${API_BASE}/api/offers/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch offer');
    return res.json();
  },

  async createOffer(data: any) {
    const res = await fetch(`${API_BASE}/api/offers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create offer');
    return res.json();
  },

  // Reservations
  async getReservations(role?: 'consumer' | 'producer') {
    const q = role ? `?role=${role}` : '';
    const res = await fetch(`${API_BASE}/api/reservations${q}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch reservations');
    return res.json();
  },

  async getReservation(id: string | number) {
    const res = await fetch(`${API_BASE}/api/reservations/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch reservation');
    return res.json();
  },

  async createReservation(data: any) {
    const res = await fetch(`${API_BASE}/api/reservations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create reservation');
    return res.json();
  },

  // Meter Readings
  async submitMeterReading(data: any) {
    const res = await fetch(`${API_BASE}/api/meters/readings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to submit meter reading');
    return res.json();
  },

  async simulateMeterPayload(reservationId?: string | number, kwhDelivered?: number) {
    const q = new URLSearchParams();
    if (reservationId) q.set('reservation_id', reservationId.toString());
    if (kwhDelivered) q.set('kwh_delivered', kwhDelivered.toString());

    const res = await fetch(`${API_BASE}/api/meters/simulate-payload?${q.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to simulate meter payload');
    return res.json();
  },

  // Community Pools
  async getPools(params?: { zone?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.zone) q.set('zone', params.zone);
    if (params?.status) q.set('status', params.status);

    const res = await fetch(`${API_BASE}/api/pools?${q.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch community pools');
    return res.json();
  },

  async getPool(id: string | number) {
    const res = await fetch(`${API_BASE}/api/pools/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch pool details');
    return res.json();
  },

  async createPool(data: any) {
    const res = await fetch(`${API_BASE}/api/pools`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create pool');
    return res.json();
  },

  async contributeToPool(poolId: string | number, amountXlm: number) {
    const res = await fetch(`${API_BASE}/api/pools/${poolId}/contribute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ amount_xlm: amountXlm }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to contribute');
    return res.json();
  },

  // Notifications & Transactions
  async getNotifications() {
    const res = await fetch(`${API_BASE}/api/notifications`, { headers: getHeaders() });
    if (!res.ok) return { notifications: [] };
    return res.json();
  },

  async markNotificationRead(id: number | string) {
    const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return res.json();
  },

  async getTransactions() {
    const res = await fetch(`${API_BASE}/api/transactions`, { headers: getHeaders() });
    if (!res.ok) return { transactions: [] };
    return res.json();
  },
};

