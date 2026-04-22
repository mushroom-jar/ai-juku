export type LevelTheme = {
  level: number;
  title: string;
  subtitle: string;
  reward: string;
  accent: string;
  bg: string;
  unlocks: string[];
};

export const LEVEL_THEMES: LevelTheme[] = [
  {
    level: 1,
    title: "\u30b9\u30bf\u30fc\u30c8",
    subtitle: "\u307e\u305a\u306f\u6bce\u65e5\u306e\u5b66\u7fd2\u3092\u7d9a\u3051\u308b\u571f\u53f0\u3065\u304f\u308a",
    reward: "\u4eca\u306f\u57fa\u672c\u306e\u8a18\u9332\u3068\u76f8\u8ac7\u3092\u5b89\u5b9a\u3057\u3066\u4f7f\u3046\u6bb5\u968e\u3067\u3059\u3002",
    accent: "#2563EB",
    bg: "#EFF6FF",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 30\u56de", "AI\u76f8\u8ac7", "\u5b66\u7fd2\u8a18\u9332\u306e\u4fdd\u5b58"],
  },
  {
    level: 2,
    title: "\u30ea\u30ba\u30e0\u4f5c\u308a",
    subtitle: "\u7d9a\u3051\u308b\u611f\u899a\u3092\u4f5c\u3063\u3066\u3044\u304f\u6bb5\u968e",
    reward: "\u5b66\u7fd2\u306e\u6d41\u308c\u304c\u6574\u3044\u59cb\u3081\u3066\u3044\u307e\u3059\u3002",
    accent: "#0F766E",
    bg: "#ECFDF5",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +0\u56de", "\u9031\u9593\u306e\u632f\u308a\u8fd4\u308a", "\u7d99\u7d9a\u8a18\u9332\u306e\u8868\u793a"],
  },
  {
    level: 3,
    title: "\u5b89\u5b9a\u5316",
    subtitle: "\u81ea\u7fd2\u304c\u7fd2\u6163\u3068\u3057\u3066\u56de\u308a\u59cb\u3081\u308b\u6bb5\u968e",
    reward: "\u8ff7\u308f\u305a\u5b66\u7fd2\u306b\u5165\u308a\u3084\u3059\u304f\u306a\u3063\u3066\u3044\u307e\u3059\u3002",
    accent: "#7C3AED",
    bg: "#F5F3FF",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +5\u56de", "\u30bf\u30a4\u30e0\u30e9\u30a4\u30f3\u6d3b\u7528", "\u6f14\u7fd2\u5c65\u6b74\u306e\u898b\u8fd4\u3057"],
  },
  {
    level: 4,
    title: "\u7a4d\u307f\u4e0a\u3052\u671f",
    subtitle: "\u8a18\u9332\u304c\u81ea\u4fe1\u306b\u5909\u308f\u308a\u59cb\u3081\u308b\u6bb5\u968e",
    reward: "\u7a4d\u307f\u4e0a\u3052\u305f\u5206\u3060\u3051\u5b9f\u611f\u304c\u51fa\u3084\u3059\u304f\u306a\u308a\u307e\u3059\u3002",
    accent: "#DB2777",
    bg: "#FDF2F8",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +5\u56de", "\u96c6\u4e2d\u5b66\u7fd2\u306e\u7a4d\u307f\u4e0a\u3052", "\u9032\u307f\u65b9\u306e\u628a\u63e1"],
  },
  {
    level: 5,
    title: "\u52a0\u901f\u671f",
    subtitle: "\u52c9\u5f37\u91cf\u3068\u8cea\u304c\u4e21\u65b9\u4f38\u3073\u3066\u304f\u308b\u6bb5\u968e",
    reward: "AI\u585e\u306e\u7121\u6599\u4f53\u9a13\u5bfe\u8c61\u306b\u8fd1\u3065\u304f\u57fa\u6e96\u3092\u6e80\u305f\u3057\u307e\u3059\u3002",
    accent: "#C2410C",
    bg: "#FFF7ED",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +10\u56de", "AI\u585e\u7121\u6599\u4f53\u9a13\u306e\u5bfe\u8c61", "\u6a21\u8a66\u5f8c\u306e\u898b\u76f4\u3057\u5f37\u5316"],
  },
  {
    level: 6,
    title: "\u5f31\u70b9\u653b\u7565",
    subtitle: "\u82e6\u624b\u3068\u5411\u304d\u5408\u3044\u3001\u6539\u5584\u3057\u3084\u3059\u304f\u306a\u308b\u6bb5\u968e",
    reward: "\u76f8\u8ac7\u306e\u8cea\u3068\u898b\u76f4\u3057\u306e\u6df1\u3055\u304c\u4e0a\u304c\u3063\u3066\u3044\u304d\u307e\u3059\u3002",
    accent: "#0891B2",
    bg: "#ECFEFF",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +10\u56de", "\u5f31\u70b9\u5206\u6790\u306e\u6d3b\u7528", "\u5fa9\u7fd2\u7cbe\u5ea6\u306e\u5411\u4e0a"],
  },
  {
    level: 7,
    title: "\u5b9a\u7740\u671f",
    subtitle: "\u5b66\u7fd2\u306e\u578b\u304c\u3057\u3063\u304b\u308a\u8eab\u306b\u3064\u3044\u3066\u304f\u308b\u6bb5\u968e",
    reward: "\u6bce\u65e5\u306e\u5224\u65ad\u304c\u3088\u308a\u30b9\u30e0\u30fc\u30ba\u306b\u306a\u308a\u307e\u3059\u3002",
    accent: "#4F46E5",
    bg: "#EEF2FF",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +15\u56de", "\u5b66\u7fd2\u30c7\u30fc\u30bf\u306e\u6d3b\u7528", "\u81ea\u5206\u5411\u3051\u306e\u6539\u5584\u304c\u3057\u3084\u3059\u3044"],
  },
  {
    level: 8,
    title: "\u81ea\u8d70\u671f",
    subtitle: "\u81ea\u5206\u3067\u6574\u3048\u3066\u9032\u3081\u308b\u529b\u304c\u80b2\u3064\u6bb5\u968e",
    reward: "\u81ea\u7fd2\u306e\u8cea\u3092\u81ea\u5206\u3067\u4e0a\u3052\u3084\u3059\u304f\u306a\u3063\u3066\u3044\u307e\u3059\u3002",
    accent: "#BE123C",
    bg: "#FFF1F2",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +15\u56de", "\u9577\u6642\u9593\u6f14\u7fd2\u306e\u7a4d\u307f\u4e0a\u3052", "AI\u76f8\u8ac7\u306e\u6d3b\u7528\u5e45\u62e1\u5927"],
  },
  {
    level: 9,
    title: "\u4ed5\u4e0a\u3052\u671f",
    subtitle: "\u672c\u756a\u3092\u610f\u8b58\u3057\u3066\u5b8c\u6210\u5ea6\u3092\u9ad8\u3081\u308b\u6bb5\u968e",
    reward: "\u7d50\u679c\u306b\u3064\u306a\u304c\u308b\u8abf\u6574\u304c\u3057\u3084\u3059\u304f\u306a\u308a\u307e\u3059\u3002",
    accent: "#B45309",
    bg: "#FEF3C7",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +20\u56de", "\u6a21\u8a66\u5f8c\u306e\u8abf\u6574\u529b\u5411\u4e0a", "\u5b66\u7fd2\u5bc6\u5ea6\u306e\u6700\u5927\u5316"],
  },
  {
    level: 10,
    title: "\u5b8c\u6210\u5f62",
    subtitle: "\u7a4d\u307f\u4e0a\u3052\u305f\u5b66\u7fd2\u304c\u5927\u304d\u306a\u6b66\u5668\u306b\u306a\u3063\u3066\u3044\u308b\u6bb5\u968e",
    reward: "\u3053\u3053\u307e\u3067\u7d9a\u3051\u305f\u7a4d\u307f\u4e0a\u3052\u306f\u5927\u304d\u306a\u5f37\u307f\u3067\u3059\u3002",
    accent: "#111827",
    bg: "#E5E7EB",
    unlocks: ["\u8cea\u554f\u4e0a\u9650 +20\u56de", "\u6700\u7d42\u5230\u9054\u30ec\u30d9\u30eb", "\u7d99\u7d9a\u306e\u8a3c"],
  },
];

export const XP_LEVELS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];

export function calcLevel(xp: number): { level: number; current: number; next: number; pct: number } {
  let level = 1;
  for (let i = XP_LEVELS.length - 1; i >= 0; i -= 1) {
    if (xp >= XP_LEVELS[i]) {
      level = i + 1;
      break;
    }
  }

  const current = XP_LEVELS[level - 1] ?? 0;
  const next = XP_LEVELS[level] ?? XP_LEVELS[XP_LEVELS.length - 1];
  const pct = next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100);
  return { level, current, next, pct };
}

export function getLevelTheme(level: number): LevelTheme {
  return LEVEL_THEMES.find((theme) => theme.level === level) ?? LEVEL_THEMES[0];
}

export function getNextLevelTheme(level: number): LevelTheme | null {
  return LEVEL_THEMES.find((theme) => theme.level === level + 1) ?? null;
}
