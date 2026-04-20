// Client-side achievement catalog. Keys here MUST match the server seed in
// server/seeds/achievements.js when the server-side flip goes live.
// Each entry's `check(ctx)` returns true when the badge should unlock given
// the attempt-completion context.
//
// ctx shape: {
//   durationMs,      // this attempt length
//   prevPb,          // personal best BEFORE this attempt (0 if none)
//   isNewPb,         // did this attempt beat the prior PB
//   now,             // Date instance at attempt completion
//   counters: {      // from store
//     total_attempts, total_hold_ms, day_keys, shared_count,
//     shorts_since_last_pb,
//   }
// }

export const ACHIEVEMENTS = [
  {
    key: 'first_liftoff',
    name: 'First Liftoff',
    description: 'Hold a handstand for 3 seconds.',
    icon: '🛫',
    glyph: 'GiRocket',
    tier: 'bronze',
    check: (c) => c.durationMs >= 3_000,
  },
  {
    key: 'five_club',
    name: '5-Second Club',
    description: 'Cross the 5-second line.',
    icon: '🖐',
    glyph: 'GiHighFive',
    tier: 'bronze',
    check: (c) => c.durationMs >= 5_000,
  },
  {
    key: 'fifteen_club',
    name: '15-Second Club',
    description: 'Hold past 15 seconds.',
    icon: '🌀',
    glyph: 'GiSpiralBloom',
    tier: 'silver',
    check: (c) => c.durationMs >= 15_000,
  },
  {
    key: 'half_minute',
    name: 'Half-Minute Hero',
    description: 'Hold a handstand for 30 seconds.',
    icon: '🏅',
    glyph: 'GiMedal',
    tier: 'gold',
    check: (c) => c.durationMs >= 30_000,
  },
  {
    key: 'minute_maker',
    name: 'Minute Maker',
    description: 'A full minute upside down.',
    icon: '👑',
    glyph: 'GiCrown',
    tier: 'gold',
    check: (c) => c.durationMs >= 60_000,
  },
  {
    key: 'two_min_titan',
    name: 'Two-Min Titan',
    description: 'Two minutes. Elite territory.',
    icon: '🗿',
    glyph: 'GiMoai',
    tier: 'mythic',
    check: (c) => c.durationMs >= 120_000,
  },
  {
    key: 'nice',
    name: 'Nice.',
    description: 'Hold for exactly 69-ish seconds.',
    icon: '😎',
    glyph: 'GiSunglasses',
    tier: 'gold',
    check: (c) => c.durationMs >= 69_000 && c.durationMs < 70_000,
  },
  {
    key: 'persistent',
    name: 'Persistent',
    description: 'Complete 10 attempts total.',
    icon: '🔁',
    glyph: 'GiCycle',
    tier: 'bronze',
    check: (c) => c.counters.total_attempts >= 10,
  },
  {
    key: 'marathoner',
    name: 'Marathoner',
    description: 'Log 30 cumulative minutes held.',
    icon: '🏃',
    glyph: 'GiSprint',
    tier: 'gold',
    check: (c) => c.counters.total_hold_ms >= 30 * 60 * 1000,
  },
  {
    key: 'streak_3',
    name: 'Three in a Row',
    description: 'Train on 3 different days.',
    icon: '📅',
    glyph: 'GiCalendar',
    tier: 'silver',
    check: (c) => c.counters.day_keys.length >= 3,
  },
  {
    key: 'comeback_kid',
    name: 'Comeback Kid',
    description: 'Beat your PB after 3+ shorter attempts.',
    icon: '💪',
    glyph: 'GiMuscleUp',
    tier: 'silver',
    check: (c) => c.isNewPb && c.counters.shorts_since_last_pb >= 3,
  },
  {
    key: 'early_bird',
    name: 'Early Bird',
    description: 'Record an attempt before 7am.',
    icon: '🌅',
    glyph: 'GiSunrise',
    tier: 'silver',
    check: (c) => c.now.getHours() < 7,
  },
  {
    key: 'night_owl',
    name: 'Night Owl',
    description: 'Record an attempt after 11pm.',
    icon: '🌙',
    glyph: 'GiOwl',
    tier: 'silver',
    check: (c) => c.now.getHours() >= 23,
  },
  {
    key: 'shared',
    name: 'Evangelist',
    description: 'Open the share panel.',
    icon: '📣',
    glyph: 'GiMegaphone',
    tier: 'bronze',
    // Unlocked via recordEvent('shared'), not on attempt complete.
    check: (c) => c.counters.shared_count >= 1,
    event: 'shared',
  },
];

export const ACHIEVEMENT_BY_KEY = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]));

export function findAchievement(key) {
  return ACHIEVEMENT_BY_KEY[key];
}
