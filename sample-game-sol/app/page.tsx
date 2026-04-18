"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  WalletButton,
  ClusterButton,
  useCluster,
} from "@/components/solana/umi-provider";
import {
  CLIENT_SLOT_ITEMS,
  type ClientSlotItem,
  type Rarity,
} from "@/config/items";
import { runShuffleFlow } from "@/lib/shuffle";

interface Particle {
  id: number;
  x: number;
  delay: number;
}

const RARITIES_FOR_STREAK: Rarity[] = ["rare", "legendary", "mythic"];
const CONFETTI_PARTICLE_COUNT = 24;
const CONFETTI_DURATION_MS = 3000;
const SHUFFLE_TICK_MS = 100;
const HISTORY_MAX_LENGTH = 5;

// MD3 Dark theme rarity tokens
// Shadows follow MD3 dark elevation: layered black shadows + accent tint border (no colored glow)
const RARITY_DARK: Record<Rarity, { surface: string; onSurface: string; accent: string; border: string }> = {
  common:    { surface: "#1E2030", onSurface: "#C5CAE9", accent: "#7986CB", border: "rgba(121,134,203,0.18)" },
  uncommon:  { surface: "#1A2420", onSurface: "#A5D6A7", accent: "#66BB6A", border: "rgba(102,187,106,0.18)" },
  rare:      { surface: "#172030", onSurface: "#90CAF9", accent: "#42A5F5", border: "rgba(66,165,245,0.20)" },
  legendary: { surface: "#221C10", onSurface: "#FFCC80", accent: "#FFA726", border: "rgba(255,167,38,0.22)" },
  mythic:    { surface: "#220F1A", onSurface: "#F48FB1", accent: "#EC407A", border: "rgba(236,64,122,0.24)" },
};

// MD3 dark elevation 2 shadow recipe: two black layers, no color
const MD3_SHADOW = "0px 1px 2px rgba(0,0,0,0.30), 0px 2px 6px rgba(0,0,0,0.22), 0px 4px 16px rgba(0,0,0,0.18)";

const DEFAULT_SURFACE = { surface: "#1C1B1F", onSurface: "#CAC4D0", accent: "#D0BCFF", border: "rgba(208,188,255,0.14)" };

function getRarity(rarity: Rarity) {
  return RARITY_DARK[rarity] ?? DEFAULT_SURFACE;
}

function pickRandomSlotItem(): ClientSlotItem {
  return CLIENT_SLOT_ITEMS[Math.floor(Math.random() * CLIENT_SLOT_ITEMS.length)];
}

function getNextStreak(current: number, item: ClientSlotItem): number {
  return RARITIES_FOR_STREAK.includes(item.rarity) ? current + 1 : 0;
}

export default function Home() {
  const { endpoint } = useCluster();
  const wallet = useWallet();

  // Split shuffle display item from the "committed" result
  // so AnimatePresence only fires once at the end, not every tick
  const [displayItem, setDisplayItem] = useState<ClientSlotItem | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [spins, setSpins] = useState(0);
  const [history, setHistory] = useState<ClientSlotItem[]>([]);
  const [streak, setStreak] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [shuffleDisplay, setShuffleDisplay] = useState<ClientSlotItem | null>(null);

  const createParticles = useCallback(() => {
    const ps: Particle[] = Array.from({ length: CONFETTI_PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
    }));
    setParticles(ps);
    setTimeout(() => setParticles([]), CONFETTI_DURATION_MS);
  }, []);

  const commitResult = useCallback(
    (finalItem: ClientSlotItem) => {
      setIsShuffling(false);
      setDisplayItem(finalItem);
      setTotalPoints((p) => p + finalItem.points);
      setSpins((p) => p + 1);
      setHistory((p) => [finalItem, ...p.slice(0, HISTORY_MAX_LENGTH - 1)]);
      setStreak((p) => getNextStreak(p, finalItem));
      if (finalItem.rarity === "mythic") {
        setShowConfetti(true);
        createParticles();
      }
    },
    [createParticles]
  );

  const shuffleItem = async () => {
    if (loading) return;
    setLoading(true);
    setIsShuffling(true);
    setShowConfetti(false);

    // Rapid visual shuffle — update a separate state so we
    // don't trigger AnimatePresence exit/enter on every tick
    const shuffleInterval = setInterval(() => {
      setShuffleDisplay(pickRandomSlotItem());
    }, SHUFFLE_TICK_MS);

    try {
      const { finalItem } = await runShuffleFlow(wallet, endpoint);
      clearInterval(shuffleInterval);
      if (finalItem) commitResult(finalItem);
    } catch (err) {
      clearInterval(shuffleInterval);
      console.error("Shuffle error:", err);
      setIsShuffling(false);
    } finally {
      setLoading(false);
    }
  };

  // During shuffle show the rapid ticker; after, show committed item
  const visibleItem = isShuffling ? shuffleDisplay : displayItem;
  const rs = visibleItem ? getRarity(visibleItem.rarity) : DEFAULT_SURFACE;

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "#141218",
        fontFamily: "'Google Sans', 'Roboto', sans-serif",
        color: "#E6E0E9",
      }}
    >
      {/* Background tonal blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-20"
          style={{ background: "#4A4080" }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
          style={{ background: "#1A3A4A" }}
        />
      </div>

      {/* Top app bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3"
        style={{
          background: "rgba(20,18,24,0.80)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(208,188,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-base"
            style={{ background: "#2D2640" }}
          >
            🎲
          </div>
          <span className="font-medium text-[#E6E0E9] text-sm tracking-wide">
            Item Shuffle
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <WalletButton />
          <ClusterButton />
        </div>
      </div>

      {/* Confetti */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: -10, x: `${p.x}vw` }}
            animate={{ opacity: 0, y: "100vh" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.8, delay: p.delay, ease: "easeIn" }}
            className="absolute top-0 text-xl pointer-events-none z-30 select-none"
            style={{ color: rs.accent }}
          >
            ✦
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-20 pb-10 gap-7">

        {/* Stats chips */}
        <div className="flex gap-2">
          {[
            { label: "Spins", value: spins, icon: "↻" },
            { label: "Points", value: totalPoints, icon: "◆" },
            { label: "Streak", value: streak, icon: "▲" },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: "#2B2930",
                border: "1px solid #49454F",
                color: "#CAC4D0",
              }}
            >
              <span style={{ color: "#D0BCFF" }}>{icon}</span>
              <span style={{ color: "#D0BCFF" }} className="font-semibold">{value}</span>
              <span style={{ color: "#79747E" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Main display card.
            The card itself stays mounted the whole time — no remounting.
            Only the inner content changes. AnimatePresence is only used
            for the final reveal so there's no jank during rapid shuffle ticks. */}
        <div
          className="relative w-72 h-72 rounded-[28px] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: rs.surface,
            boxShadow: MD3_SHADOW,
            outline: `1px solid ${rs.border}`,
            transition: isShuffling ? "none" : "background 0.4s ease, outline-color 0.4s ease",
          }}
        >
          {/* Shimmer overlay while shuffling */}
          {isShuffling && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(105deg, transparent 30%, ${rs.accent}18 50%, transparent 70%)`,
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
          )}

          {visibleItem ? (
            <AnimatePresence mode="wait">
              <motion.div
                // Only change the key on final commit, not every shuffle tick
                key={isShuffling ? "shuffling" : visibleItem.name}
                initial={isShuffling ? false : { opacity: 0, scale: 0.88, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={isShuffling ? undefined : { opacity: 0, scale: 0.92, y: -10 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="flex flex-col items-center gap-3 px-6 select-none"
              >
                <motion.div
                  animate={
                    isShuffling
                      ? { scale: [1, 1.04, 1] }
                      : showConfetti
                      ? { scale: [1, 1.18, 1], rotate: [0, 10, -10, 0] }
                      : { scale: 1 }
                  }
                  transition={
                    isShuffling
                      ? { duration: 0.2, repeat: Infinity }
                      : { duration: 0.45 }
                  }
                  className="text-8xl leading-none"
                >
                  {visibleItem.emoji}
                </motion.div>

                <div
                  className="text-lg font-semibold tracking-tight text-center leading-snug"
                  style={{ color: rs.onSurface }}
                >
                  {visibleItem.name}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                    style={{ background: `${rs.accent}22`, color: rs.accent }}
                  >
                    {visibleItem.rarity}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "#2D2640", color: "#D0BCFF" }}
                  >
                    +{visibleItem.points} pts
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 select-none"
            >
              <span className="text-6xl opacity-20">🎲</span>
              <p className="text-sm" style={{ color: "#49454F" }}>
                Tap spin to begin
              </p>
            </motion.div>
          )}
        </div>

        {/* Spin button — MD3 filled tonal button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onHoverStart={() => setBtnHover(true)}
          onHoverEnd={() => setBtnHover(false)}
          onClick={shuffleItem}
          disabled={loading}
          className="relative flex items-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-semibold overflow-hidden select-none"
          style={{
            background: loading ? "#4A4458" : "#D0BCFF",
            color: loading ? "#CAC4D0" : "#381E72",
            boxShadow: btnHover && !loading ? "0 4px 12px rgba(208,188,255,0.28)" : "none",
            transition: "background 0.2s, box-shadow 0.2s",
            letterSpacing: "0.03em",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: "#381E72" }}
            animate={{ opacity: btnHover && !loading ? 0.08 : 0 }}
            transition={{ duration: 0.15 }}
          />
          <span className="relative flex items-center gap-2.5">
            {loading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                  style={{ fontSize: "1rem", lineHeight: 1 }}
                >
                  ↻
                </motion.span>
                Shuffling…
              </>
            ) : (
              <>
                <span style={{ fontSize: "1rem" }}>🎲</span>
                Spin
              </>
            )}
          </span>
        </motion.button>

        {/* History chips */}
        <AnimatePresence>
          {history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md"
            >
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3 text-center"
                style={{ color: "#49454F", letterSpacing: "0.14em" }}
              >
                Recent Spins
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {history.map((item, idx) => {
                  const irs = getRarity(item.rarity);
                  return (
                    <motion.div
                      key={`${item.name}-${idx}`}
                      initial={{ opacity: 0, scale: 0.75, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        delay: idx * 0.05,
                        type: "spring",
                        stiffness: 360,
                        damping: 24,
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-2xl"
                      style={{
                        background: irs.surface,
                        border: `1px solid ${irs.border}`,
                        boxShadow: "0px 1px 2px rgba(0,0,0,0.24), 0px 2px 6px rgba(0,0,0,0.16)",
                      }}
                    >
                      <span className="text-2xl leading-none select-none">{item.emoji}</span>
                      <span className="text-xs font-semibold" style={{ color: irs.accent }}>
                        +{item.points}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}