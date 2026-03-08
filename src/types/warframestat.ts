// ─── Shared primitives ────────────────────────────────────────────────────────

export interface TimedEvent {
  id: string;
  activation: string; // ISO 8601
  expiry: string; // ISO 8601
}

export interface CountedItem {
  count: number;
  type: string;
  key: string;
}

export interface Reward {
  items: string[];
  countedItems: CountedItem[];
  credits: number;
}

// ─── Void Trader (Baro Ki'Teer) ───────────────────────────────────────────────

export interface VoidTraderInventoryItem {
  uniqueName: string;
  item: string;
  ducats: number;
  credits: number;
}

export interface VoidTrader extends TimedEvent {
  character: string; // "Baro Ki'Teer"
  location: string; // "Kronia Relay (Saturn)"
  inventory: VoidTraderInventoryItem[];
}

// ─── Vault Trader (Varzia / Prime Resurgence) ─────────────────────────────────

export interface VaultTraderInventoryItem {
  uniqueName: string;
  item: string;
  ducats: number | null; // Aya cost (NOT ducats). null for credit-only relics.
  credits: number | null;
}

export interface VaultTrader extends TimedEvent {
  character: string; // "Varzia"
  location: string; // "Maroo's Bazaar (Mars)"
  inventory: VaultTraderInventoryItem[];
}

// ─── Void Fissures ────────────────────────────────────────────────────────────

export type FissureTier =
  | "Lith"
  | "Meso"
  | "Neo"
  | "Axi"
  | "Requiem"
  | "Omnia";

export interface Fissure extends TimedEvent {
  node: string; // "Adaro (Sedna)"
  missionType: string; // "Extermination"
  missionTypeKey: string;
  enemy: string; // "Grineer"
  enemyKey: string;
  nodeKey: string;
  tier: FissureTier;
  tierNum: number; // 1–6
  isStorm: boolean; // Void Storm (Railjack)
  isHard: boolean; // Steel Path
}

// ─── Sortie ───────────────────────────────────────────────────────────────────

export interface SortieVariant {
  missionType: string;
  missionTypeKey: string;
  modifier: string;
  modifierDescription: string;
  node: string;
  nodeKey: string;
}

export interface Sortie extends TimedEvent {
  rewardPool: string;
  variants: SortieVariant[];
  boss: string;
  faction: string;
  factionKey: string;
}

// ─── Archon Hunt ──────────────────────────────────────────────────────────────

export interface ArchonMission {
  node: string;
  nodeKey: string;
  type: string;
  typeKey: string;
}

export interface ArchonHunt extends TimedEvent {
  rewardPool: string;
  variants: unknown[]; // Always empty array
  missions: ArchonMission[];
  boss: string;
  faction: string;
  factionKey: string;
}

// ─── Nightwave ────────────────────────────────────────────────────────────────

export interface NightwaveChallenge extends TimedEvent {
  isDaily: boolean;
  isElite: boolean;
  desc: string;
  title: string;
  reputation: number;
  isPermanent: boolean;
}

export interface Nightwave extends TimedEvent {
  season: number;
  tag: string;
  phase: number;
  activeChallenges: NightwaveChallenge[];
}

// ─── Invasions ────────────────────────────────────────────────────────────────

export interface InvasionFaction {
  reward: Reward;
  faction: string;
  factionKey: string;
}

export interface Invasion extends TimedEvent {
  node: string;
  nodeKey: string;
  desc: string;
  attacker: InvasionFaction;
  defender: InvasionFaction;
  vsInfestation: boolean;
  count: number;
  requiredRuns: number;
  completion: number; // Percentage 0–100
  completed: boolean;
  rewardTypes: string[]; // e.g. ["vandal", "wraith"]
}

// ─── Steel Path ───────────────────────────────────────────────────────────────

export interface SteelPathReward {
  name: string;
  cost: number;
}

export interface SteelPathIncursions extends TimedEvent {
  // Has id, activation, expiry only
}

export interface SteelPath {
  currentReward: SteelPathReward;
  activation: string;
  expiry: string;
  remaining: string;
  rotation: SteelPathReward[];
  evergreens: SteelPathReward[];
  incursions: SteelPathIncursions;
}

// ─── Open World Cycles ────────────────────────────────────────────────────────

export interface CetusCycle extends TimedEvent {
  isDay: boolean;
  state: "day" | "night";
  timeLeft: string;
  isCetus: boolean;
}

export interface VallisCycle extends TimedEvent {
  isWarm: boolean;
  state: "warm" | "cold";
}

export interface CambionCycle extends TimedEvent {
  timeLeft: string;
  state: "fass" | "vome";
}

export interface EarthCycle extends TimedEvent {
  isDay: boolean;
  state: "day" | "night";
  timeLeft: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventInterimStep {
  goal: number;
  reward: Reward;
}

export interface GameEvent extends TimedEvent {
  description: string;
  tooltip: string;
  node: string;
  health: number;
  rewards: Reward[];
  interimSteps: EventInterimStep[];
  isPersonal: boolean;
  isCommunity: boolean;
}

// ─── Construction Progress ────────────────────────────────────────────────────

export interface ConstructionProgress {
  id: string;
  fomorianProgress: string; // "45.08"
  razorbackProgress: string; // "46.22"
  unknownProgress: string; // "0.00"
}

// ─── Daily Deals ─────────────────────────────────────────────────────────────

export interface DailyDeal extends TimedEvent {
  item: string;
  uniqueName: string;
  originalPrice: number;
  salePrice: number;
  total: number;
  sold: number;
  discount: number;
}

// ─── Simaris ──────────────────────────────────────────────────────────────────

export interface Simaris {
  target: string;
  isTargetActive: boolean;
}

// ─── Rivens ───────────────────────────────────────────────────────────────────

export interface RivenStats {
  itemType: string;
  compatibility: string;
  rerolled: boolean;
  avg: number;
  stddev: number;
  min: number;
  max: number;
  pop: number;
  median: number;
}

export interface RivenEntry {
  rerolled: RivenStats;
  unrolled: RivenStats;
}

export type RivenSearchResult = Record<string, RivenEntry>;

// ─── Drop Tables ──────────────────────────────────────────────────────────────

export interface DropResult {
  place: string; // "Axi A7 Relic (Radiant)" or "Draco (Ceres) — Survival"
  item: string; // "Ash Prime Systems Blueprint"
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
  chance: number; // PERCENTAGE (e.g. 25.33 = 25.33%). NOT a decimal.
}

// ─── Sol Nodes ────────────────────────────────────────────────────────────────

export interface SolNode {
  value: string; // "Hydron (Sedna)"
  enemy: string; // "Grineer"
  type: string; // "Defense"
}

export interface SolNodeResult {
  keys: string[];
  nodes: SolNode[];
}

// ─── Item Database (warframes, weapons, mods, items) ─────────────────────────

export interface ItemIntroduced {
  name: string; // "Update 12.4"
  url?: string;
  date: string; // "2014-03-05"
}

export interface ItemDrop {
  chance: number; // DECIMAL (0.02 = 2%). Different scale from DropResult.chance.
  location: string; // "Axi R1 Relic" or "Kuva Scorpion"
  rarity: string;
  type: string;
}

export interface ItemComponent {
  uniqueName?: string;
  name: string;
  description?: string;
  itemCount?: number;
  primeSellingPrice?: number; // Ducat value
  tradable?: boolean;
  ducats?: number;
  drops?: ItemDrop[];
}

export interface WarframeAbility {
  uniqueName?: string;
  name: string;
  description: string;
  imageName?: string;
}

export interface WarframeItem {
  uniqueName: string;
  name: string;
  description?: string;
  type: string; // "Warframe"
  category: string; // "Warframes"
  abilities?: WarframeAbility[];
  health?: number;
  shield?: number;
  armor?: number;
  energy?: number;
  power?: number;
  sprint?: number;
  stamina?: number;
  aura?: string; // Polarity name: "madurai"
  polarities?: string[];
  passiveDescription?: string;
  components?: ItemComponent[];
  buildPrice?: number;
  buildQuantity?: number;
  buildTime?: number; // Seconds
  masteryReq?: number;
  isPrime?: boolean;
  vaulted?: boolean;
  tradable?: boolean;
  introduced?: ItemIntroduced;
  wikiaThumbnail?: string;
  imageName?: string;
}

export interface WeaponAttack {
  name: string; // "Fully Spooled" or "Incarnon Form"
  speed?: number; // Fire rate
  crit_chance?: number; // Percentage (30 = 30%)
  crit_mult?: number; // Multiplier (3 = 3.0x)
  status_chance?: number;
  shot_type?: string; // "Hit-Scan" or "Projectile"
  damage?: Record<string, number>; // { impact: 1.2, slash: 6, ... }
}

export interface WeaponItem {
  uniqueName: string;
  name: string;
  description?: string;
  type: string; // "Primary", "Secondary", "Melee"
  category: string;
  attacks?: WeaponAttack[];
  accuracy?: number;
  magazineSize?: number;
  masteryReq?: number;
  noise?: string; // "ALARMING" or "SILENT"
  trigger?: string; // "AUTO", "SEMI", "BURST", etc.
  polarities?: string[];
  components?: ItemComponent[];
  buildPrice?: number;
  buildTime?: number;
  slot?: number;
  isPrime?: boolean;
  vaulted?: boolean;
  tradable?: boolean;
  releaseDate?: string;
  introduced?: ItemIntroduced;
  wikiaThumbnail?: string;
  imageName?: string;
}

export interface ModLevelStat {
  stats: string[]; // ["+15% Damage"]
}

export interface ModItem {
  uniqueName: string;
  name: string;
  type: string; // "Rifle Mod", "Pistol Mod", "Warframe Mod", etc.
  category: string; // "Mods"
  compatName: string; // "Rifle", "Pistol", "Warframe", etc.
  polarity: string; // "madurai", "vazarin", etc.
  rarity: string;
  baseDrain: number;
  fusionLimit: number; // Max rank
  levelStats?: ModLevelStat[];
  drops?: ItemDrop[];
  tradable?: boolean;
  transmutable?: boolean;
  isPrime?: boolean;
  introduced?: ItemIntroduced;
  imageName?: string;
}

export interface GenericItem {
  uniqueName: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  drops?: ItemDrop[];
  components?: ItemComponent[];
  levelStats?: ModLevelStat[]; // For arcanes
  tradable?: boolean;
  masterable?: boolean;
  vaulted?: boolean;
  rarity?: string;
  fusionLimit?: number; // For arcanes: max rank
  introduced?: ItemIntroduced;
  wikiaThumbnail?: string;
  imageName?: string;
}
