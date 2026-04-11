import type { Address } from "viem";

export const GAME_FACTORY_ABI = [
  {
    type: "function",
    name: "gameItems",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export function isHexAddress(value: string | null | undefined): value is Address {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
