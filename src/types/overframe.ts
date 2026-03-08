// ─── Overframe Types ──────────────────────────────────────────────────────────

export interface OverframeBuildSummary {
  id: number;
  created: string;
  updated: string;
  score: number;
  url: string;
  author: {
    id: number;
    username: string;
    url: string;
    is_staff: boolean;
  };
  formas: number;
  guide_wordcount?: number;
  item_data: {
    id: number;
    locTag: string;
    texture?: string;
    texture_new: string;
  };
  title: string;
}

export interface OverframeBuildSlot {
  id: number;
  slot_id: number; // 1-8 normal, 9 aura, 10 exilus, 11-12 arcanes
  build_id: number;
  mod: number; // Overframe internal mod ID
  rank: number;
  polarity: number; // 0=none, 1=Madurai, 3=Naramon, 4=Zenurik, 9=Aura
  drain: number;
  polarity_match: number;
}

export interface OverframeBuildStats {
  AVATAR_ARMOUR?: number | null;
  AVATAR_HEALTH_MAX?: number | null;
  AVATAR_SHIELD_MAX?: number | null;
  AVATAR_POWER_MAX?: number | null;
  AVATAR_SPRINT_SPEED?: number | null;
  AVATAR_ABILITY_RANGE?: number | null;
  AVATAR_ABILITY_DURATION?: number | null;
  AVATAR_ABILITY_STRENGTH?: number | null;
  AVATAR_ABILITY_EFFICIENCY?: number | null;
  WEAPON_CLIP_MAX?: number | null;
  [key: string]: number | null | undefined;
}

export interface OverframeBuildDetail {
  id: number;
  created: string;
  updated: string;
  score: number;
  url: string;
  author: {
    id: number;
    username: string;
    url: string;
    is_staff: boolean;
  };
  formas: number;
  item_data: {
    id: number;
    locTag: string;
    texture?: string;
    texture_new: string;
  };
  title: string;
  buildstring: string;
  description: string;
  comment_count: number;
  slots: OverframeBuildSlot[];
  item: number;
  platinum_cost: number;
  endo_cost: number;
  item_rank: number;
  mastery_rank: number;
  stats: OverframeBuildStats;
  total_damage: number;
}

export interface OverframeItemData {
  categories: string[];
  id: number;
  name: string;
  path: string;
  tag: string;
  texture_new: string;
}

/** Shape of __NEXT_DATA__.props.pageProps on a build page */
export interface OverframeBuildPageProps {
  data: OverframeBuildDetail;
  id: number;
  item: OverframeItemData;
  buildState: {
    item: string;
    itemRank: number;
    orokin: boolean;
    mods: Array<{ modId: number; rank: number; polarity: number }>;
  };
  guideMarkdown: string;
  itemBuilds: OverframeBuildSummary[];
  authorBuilds: OverframeBuildSummary[];
}
