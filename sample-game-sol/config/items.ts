/**
 * Shared slot items and rarity weights for game-casino.
 * Used by both API route (shuffle) and client (page) to keep outcomes in sync.
 */

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "legendary"
  | "mythic";

export interface SlotItem {
  emoji: string;
  name: string;
  rarity: Rarity;
  points: number;
  description: string;
}

/** Rarity weights (percent-like); must sum to 100 for consistent distribution. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 40,
  uncommon: 30,
  rare: 20,
  legendary: 8,
  mythic: 2,
};

export const SLOT_ITEMS: SlotItem[] = [
  { emoji: "🐄", name: "Cow", rarity: "common", points: 10, description: "A random cow" },
  { emoji: "🦝", name: "Raccoon", rarity: "common", points: 15, description: "A random raccoon" },
  { emoji: "🍉", name: "Watermelon", rarity: "uncommon", points: 25, description: "A random melon" },
  { emoji: "🐻", name: "Bear", rarity: "rare", points: 50, description: "A random and very uncommon bear" },
  { emoji: "⚔️", name: "Sword", rarity: "legendary", points: 100, description: "A legendary sword" },
  { emoji: "🦜", name: "Parrot", rarity: "mythic", points: 500, description: "A mythical parrot" },
];

const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);

/** Pick one item at random according to rarity weights. */
export function getWeightedRandomItem(): SlotItem {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const item of SLOT_ITEMS) {
    r -= RARITY_WEIGHTS[item.rarity];
    if (r <= 0) return item;
  }
  return SLOT_ITEMS[0];
}

// —— Client display (Tailwind gradient classes) ——

export const RARITY_TEXT_COLOR: Record<Rarity, string> = {
  common: "text-gray-400",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  legendary: "text-purple-400",
  mythic: "text-pink-400",
};

export const RARITY_GRADIENT: Record<Rarity, string> = {
  common: "from-red-500 to-pink-600",
  uncommon: "from-green-500 to-emerald-600",
  rare: "from-amber-500 to-orange-600",
  legendary: "from-cyan-400 to-blue-600",
  mythic: "from-purple-500 to-pink-600",
};

export interface ClientSlotItem extends SlotItem {
  color: string;
}

/** Slot items with gradient class for client UI. */
export const CLIENT_SLOT_ITEMS: ClientSlotItem[] = SLOT_ITEMS.map((item) => ({
  ...item,
  color: RARITY_GRADIENT[item.rarity],
}));
