export type BadgeDefinition = {
  id: string;
  label: string;
  description: string;
  emoji: string;
};

export type ContinuitySnapshot = {
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  unlockedBadgeIds: string[];
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: "first_step", label: "はじめの一歩", description: "最初の学習記録をつけた", emoji: "seed" },
  { id: "streak_3", label: "3日連続", description: "3日連続で学習した", emoji: "flame" },
  { id: "streak_7", label: "7日連続", description: "7日連続で学習した", emoji: "rocket" },
  { id: "active_10", label: "10日行動", description: "合計10日学習した", emoji: "calendar" },
  { id: "questions_10", label: "質問10回", description: "問題質問を10回使った", emoji: "spark" },
  { id: "practice_30", label: "演習30問", description: "30問ぶんの演習を記録した", emoji: "trophy" },
  { id: "xp_500", label: "XP 500", description: "累計XPが500に到達した", emoji: "star" },
];

export function computeContinuitySnapshot({
  activeDateStrings,
  questionCount,
  practiceCount,
  xp,
}: {
  activeDateStrings: string[];
  questionCount: number;
  practiceCount: number;
  xp: number;
}): ContinuitySnapshot {
  const dates = Array.from(new Set(activeDateStrings.filter(Boolean))).sort();
  const activeDays = dates.length;
  const dateSet = new Set(dates);
  const today = new Date();

  let currentStreak = 0;
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().split("T")[0];

    if (dateSet.has(key)) {
      currentStreak += 1;
      continue;
    }

    if (i === 0) {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (dateSet.has(yesterday.toISOString().split("T")[0])) continue;
    }

    break;
  }

  let longestStreak = 0;
  let rolling = 0;
  let previousDate: Date | null = null;

  for (const value of dates) {
    const currentDate = new Date(`${value}T00:00:00`);
    if (!previousDate) {
      rolling = 1;
    } else {
      const diff = Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000);
      rolling = diff === 1 ? rolling + 1 : 1;
    }

    longestStreak = Math.max(longestStreak, rolling);
    previousDate = currentDate;
  }

  const unlockedBadgeIds = BADGE_DEFINITIONS.filter((badge) => {
    switch (badge.id) {
      case "first_step":
        return activeDays >= 1;
      case "streak_3":
        return longestStreak >= 3;
      case "streak_7":
        return longestStreak >= 7;
      case "active_10":
        return activeDays >= 10;
      case "questions_10":
        return questionCount >= 10;
      case "practice_30":
        return practiceCount >= 30;
      case "xp_500":
        return xp >= 500;
      default:
        return false;
    }
  }).map((badge) => badge.id);

  return {
    currentStreak,
    longestStreak,
    activeDays,
    unlockedBadgeIds,
  };
}
