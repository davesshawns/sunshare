use soroban_sdk::{contracterror, contracttype, Address, BytesN, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SunshareError {
    AlreadyInitialized = 1,
    OfferNotFound = 2,
    OfferNotActive = 3,
    OfferAlreadyExists = 4,
    InsufficientCapacity = 5,
    ReservationNotFound = 6,
    ReservationNotLocked = 7,
    ReservationNotExpired = 8,
    ReservationExpired = 9,
    Unauthorized = 10,
    InvalidAmount = 11,
    ArithmeticOverflow = 12,
    InvalidMeterSignature = 13,
    NonceAlreadyUsed = 14,
    DeliveryTimestampInvalid = 15,
    PoolNotFound = 16,
    PoolGoalNotReached = 17,
    PoolAlreadyFinalized = 18,
    DisputeNotActive = 19,
    InvalidSplit = 20,
    ZeroDelivery = 21,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OfferStatus {
    Active = 0,
    Paused = 1,
    Completed = 2,
    Cancelled = 3,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ReservationStatus {
    Locked = 0,
    Delivered = 1,
    Expired = 2,
    Disputed = 3,
    Refunded = 4,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolStatus {
    Funding = 0,
    GoalReached = 1,
    Withdrawn = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnergyOffer {
    pub offer_id: u64,
    pub producer: Address,
    pub token: Address,
    pub total_capacity_kwh: u64,
    pub available_capacity_kwh: u64,
    pub price_per_kwh_stroops: i128,
    pub window_start: u64,
    pub window_end: u64,
    pub zone_id: Symbol,
    pub meter_pubkey: BytesN<32>,
    pub status: OfferStatus,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnergyReservation {
    pub reservation_id: u64,
    pub offer_id: u64,
    pub producer: Address,
    pub consumer: Address,
    pub token: Address,
    pub kwh_reserved: u64,
    pub total_deposit_stroops: i128,
    pub expiry_timestamp: u64,
    pub status: ReservationStatus,
    pub delivered_kwh: u64,
    pub settled_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunityPool {
    pub pool_id: u64,
    pub creator: Address,
    pub token: Address,
    pub title: Symbol,
    pub target_funding_stroops: i128,
    pub current_funding_stroops: i128,
    pub deadline: u64,
    pub status: PoolStatus,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProducerReputation {
    pub total_delivered_kwh: u64,
    pub successful_deliveries: u32,
    pub disputes_count: u32,
}

#[contracttype]
pub enum DataKey {
    Offer(u64),
    Reservation(u64),
    Pool(u64),
    PoolContribution(u64, Address),
    UsedNonce(BytesN<32>),
    Reputation(Address),
    Admin,
}
