export interface MarketItemI18n {
  name: string;
  icon: string;
  thumb: string;
  description?: string;
  wikiLink?: string;
}

export interface MarketItem {
  id: string;
  slug: string; // URL-safe identifier used in order queries
  gameRef?: string; // "/Lotus/Powersuits/Ninja/AshPrime"
  tags: string[]; // ["set", "prime", "warframe"]
  ducats?: number;
  maxRank?: number; // For mods/arcanes
  setRoot?: boolean;
  setParts?: string[];
  tradingTax?: number;
  tradable?: boolean;
  reqMasteryRank?: number;
  i18n: {
    en: MarketItemI18n;
    [lang: string]: MarketItemI18n;
  };
}

export type MarketItemsResponse = MarketItem[];

export interface MarketItemDetailResponse {
  apiVersion: string;
  data: MarketItem;
}

export type OrderType = "sell" | "buy";
export type UserStatus = "ingame" | "online" | "offline";
export type MarketPlatform = "pc" | "ps4" | "xbox" | "switch";

export interface MarketOrderUser {
  id?: string;
  ingameName: string;
  slug?: string;
  avatar?: string;
  reputation: number;
  platform: MarketPlatform;
  crossplay: boolean;
  locale?: string;
  status: UserStatus;
  lastSeen?: string;
}

export interface MarketOrder {
  id: string;
  type: OrderType;
  platinum: number;
  quantity: number;
  perTrade?: number;
  visible?: boolean;
  rank?: number; // Mod/arcane rank. 0 = unranked. Only on rankable items.
  createdAt?: string;
  updatedAt?: string;
  itemId?: string;
  user: MarketOrderUser;
}

export interface MarketOrdersResponse {
  apiVersion: string;
  data: MarketOrder[];
}

// Computed locally — not from API
export interface PriceSummary {
  min: number;
  max: number;
  median: number;
  average: number;
  count: number;
}

export interface MarketPriceResult {
  itemName: string;
  slug: string;
  sell: PriceSummary;
  buy: PriceSummary;
  cheapestSellers: Array<{
    ingameName: string;
    platinum: number;
    quantity: number;
    status: UserStatus;
    rank?: number;
  }>;
}
