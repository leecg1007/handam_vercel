function dateOrdinal(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateLongestStreak(dateKeys) {
  const days = [...new Set((dateKeys || []).map(dateOrdinal).filter(Number.isFinite))].sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = null;
  for (const day of days) {
    current = previous !== null && day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

export function calculateCurrentStreak(dateKeys, anchorKey) {
  const anchor = dateOrdinal(anchorKey);
  if (!Number.isFinite(anchor)) return 0;
  const days = new Set((dateKeys || []).map(dateOrdinal).filter(Number.isFinite));
  let streak = 0;
  while (days.has(anchor - streak)) streak += 1;
  return streak;
}

export function calculateDiaryStats(entries = []) {
  const dated = entries.filter((entry) => dateOrdinal(entry?.dateKey) !== null);
  const dateKeys = dated.map((entry) => entry.dateKey);
  const moods = new Map();

  for (const entry of dated) {
    const mood = String(entry.mood || "").trim();
    if (!mood) continue;
    const existing = moods.get(mood) || { mood, count: 0, latestAt: 0 };
    existing.count += 1;
    existing.latestAt = Math.max(existing.latestAt, timestamp(entry.createdAt));
    moods.set(mood, existing);
  }

  const moodTotal = [...moods.values()].reduce((sum, item) => sum + item.count, 0);
  const distribution = [...moods.values()]
    .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt || a.mood.localeCompare(b.mood, "ko"))
    .map((item) => ({
      mood: item.mood,
      count: item.count,
      percentage: moodTotal ? Math.round((item.count / moodTotal) * 100) : 0,
    }));

  return {
    recordCount: dated.length,
    daysWritten: new Set(dateKeys).size,
    longestStreak: calculateLongestStreak(dateKeys),
    dominantMood: distribution[0]?.mood || "",
    distribution,
  };
}
