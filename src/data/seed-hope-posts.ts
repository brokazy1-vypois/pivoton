import type { HopePost, HopeUserProfile } from "@/types/hope-post";
import { enrichHopePostsWithGeo, DEFAULT_MAP_CENTER } from "@/lib/hope-geo";

export const SEED_USERS: HopeUserProfile[] = [
  {
    id: "seed-amelia",
    fullName: "Amelia Roux",
    job_role: "Premium Investor",
    avatar: "AR",
  },
  {
    id: "seed-daniel",
    fullName: "Daniel Okafor",
    job_role: "Derivatives Adviser",
    avatar: "DO",
  },
  {
    id: "seed-marisol",
    fullName: "Marisol Vega",
    job_role: "Senior Equity Strategist",
    avatar: "MV",
  },
  {
    id: "seed-hana",
    fullName: "Hana Ito",
    job_role: "Quant Research Lead",
    avatar: "HI",
  },
  {
    id: "seed-marcus",
    fullName: "Marcus Vance",
    job_role: "Fixed Income PM",
    avatar: "MC",
  },
];

const USER_MAP = Object.fromEntries(SEED_USERS.map((u) => [u.id, u])) as Record<
  string,
  HopeUserProfile
>;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}

function daysAgo(d: number, h = 0): string {
  return new Date(Date.now() - (d * 86400000 + h * 3600000)).toISOString();
}

type SeedEntry = Omit<HopePost, "id"> & { id: string };

const SEED_ENTRIES: SeedEntry[] = [
  // Amelia Roux — 5 posts
  {
    id: "seed-p-001",
    user_id: "seed-amelia",
    author_name: "Amelia Roux",
    author_avatar: "AR",
    job_role: "Premium Investor",
    content:
      "I hope to fund my mother's clinic bill by the end of this quarter without touching the emergency fund.",
    likes_count: 128,
    created_at: hoursAgo(2),
  },
  {
    id: "seed-p-002",
    user_id: "seed-amelia",
    author_name: "Amelia Roux",
    author_avatar: "AR",
    job_role: "Premium Investor",
    content: "I hope to close the year above break-even.",
    likes_count: 94,
    created_at: daysAgo(14),
    hope_status: "fulfilled",
  },
  {
    id: "seed-p-003",
    user_id: "seed-amelia",
    author_name: "Amelia Roux",
    author_avatar: "AR",
    job_role: "Premium Investor",
    content: "I want to learn options hedging properly before expanding into international ETFs.",
    likes_count: 67,
    created_at: daysAgo(21),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-004",
    user_id: "seed-amelia",
    author_name: "Amelia Roux",
    author_avatar: "AR",
    job_role: "Premium Investor",
    content: "I hope to fund a second income stream through dividend aristocrats by Q3.",
    likes_count: 81,
    created_at: daysAgo(28),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-005",
    user_id: "seed-amelia",
    author_name: "Amelia Roux",
    author_avatar: "AR",
    job_role: "Premium Investor",
    content: "I want my portfolio to weather a 15% drawdown without panic-selling.",
    likes_count: 52,
    created_at: daysAgo(35),
    hope_status: "fulfilled",
  },

  // Daniel Okafor — 4 posts
  {
    id: "seed-p-006",
    user_id: "seed-daniel",
    author_name: "Daniel Okafor",
    author_avatar: "DO",
    job_role: "Derivatives Adviser",
    content:
      "I hope every client I advise this month leaves with a written risk budget — no exceptions.",
    likes_count: 76,
    created_at: hoursAgo(4),
  },
  {
    id: "seed-p-007",
    user_id: "seed-daniel",
    author_name: "Daniel Okafor",
    author_avatar: "DO",
    job_role: "Derivatives Adviser",
    content: "I want to master iron condor sizing so max loss never exceeds 2% of NAV.",
    likes_count: 43,
    created_at: daysAgo(10),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-008",
    user_id: "seed-daniel",
    author_name: "Daniel Okafor",
    author_avatar: "DO",
    job_role: "Derivatives Adviser",
    content: "I hope to publish a plain-English guide on protective puts for retail investors.",
    likes_count: 112,
    created_at: daysAgo(18),
    hope_status: "fulfilled",
  },
  {
    id: "seed-p-009",
    user_id: "seed-daniel",
    author_name: "Daniel Okafor",
    author_avatar: "DO",
    job_role: "Derivatives Adviser",
    content: "I want my desk to finish the quarter with zero compliance exceptions.",
    likes_count: 38,
    created_at: daysAgo(30),
    hope_status: "fulfilled",
  },

  // Marisol Vega — 5 posts
  {
    id: "seed-p-010",
    user_id: "seed-marisol",
    author_name: "Marisol Vega",
    author_avatar: "MV",
    job_role: "Senior Equity Strategist",
    content:
      "I want every retail investor in this room to finish the year with their capital intact — growth is the second goal.",
    likes_count: 203,
    created_at: hoursAgo(5),
  },
  {
    id: "seed-p-011",
    user_id: "seed-marisol",
    author_name: "Marisol Vega",
    author_avatar: "MV",
    job_role: "Senior Equity Strategist",
    content: "I hope to launch a sector-rotation model that beats the benchmark on a 3-year horizon.",
    likes_count: 89,
    created_at: daysAgo(8),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-012",
    user_id: "seed-marisol",
    author_name: "Marisol Vega",
    author_avatar: "MV",
    job_role: "Senior Equity Strategist",
    content: "I want to mentor three junior analysts into lead strategist roles this cycle.",
    likes_count: 64,
    created_at: daysAgo(16),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-013",
    user_id: "seed-marisol",
    author_name: "Marisol Vega",
    author_avatar: "MV",
    job_role: "Senior Equity Strategist",
    content: "I hope small-cap exposure stays below 12% until volatility normalizes.",
    likes_count: 47,
    created_at: daysAgo(24),
    hope_status: "fulfilled",
  },
  {
    id: "seed-p-014",
    user_id: "seed-marisol",
    author_name: "Marisol Vega",
    author_avatar: "MV",
    job_role: "Senior Equity Strategist",
    content: "I want our ESG sleeve to outperform the broad index for the fourth consecutive quarter.",
    likes_count: 71,
    created_at: daysAgo(40),
    hope_status: "fulfilled",
  },

  // Hana Ito — 4 posts
  {
    id: "seed-p-015",
    user_id: "seed-hana",
    author_name: "Hana Ito",
    author_avatar: "HI",
    job_role: "Quant Research Lead",
    content:
      "I hope our factor-momentum signal clears out-of-sample validation before we size it live.",
    likes_count: 58,
    created_at: hoursAgo(7),
  },
  {
    id: "seed-p-016",
    user_id: "seed-hana",
    author_name: "Hana Ito",
    author_avatar: "HI",
    job_role: "Quant Research Lead",
    content: "I want to reduce backtest overfitting by enforcing walk-forward on every new alpha.",
    likes_count: 92,
    created_at: daysAgo(12),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-017",
    user_id: "seed-hana",
    author_name: "Hana Ito",
    author_avatar: "HI",
    job_role: "Quant Research Lead",
    content: "I hope to open-source our transaction-cost model for the community to stress-test.",
    likes_count: 134,
    created_at: daysAgo(20),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-018",
    user_id: "seed-hana",
    author_name: "Hana Ito",
    author_avatar: "HI",
    job_role: "Quant Research Lead",
    content: "I want Sharpe above 1.2 on the multi-factor book through year-end.",
    likes_count: 41,
    created_at: daysAgo(32),
    hope_status: "fulfilled",
  },

  // Marcus Vance — 4 posts
  {
    id: "seed-p-019",
    user_id: "seed-marcus",
    author_name: "Marcus Vance",
    author_avatar: "MC",
    job_role: "Fixed Income PM",
    content:
      "I hope the ladder we built in T-bills and IG corporates keeps duration under 3.5 years through the rate cycle.",
    likes_count: 63,
    created_at: hoursAgo(9),
  },
  {
    id: "seed-p-020",
    user_id: "seed-marcus",
    author_name: "Marcus Vance",
    author_avatar: "MC",
    job_role: "Fixed Income PM",
    content: "I want credit spread widening to stay a tail risk, not a base case, for our clients.",
    likes_count: 55,
    created_at: daysAgo(11),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-021",
    user_id: "seed-marcus",
    author_name: "Marcus Vance",
    author_avatar: "MC",
    job_role: "Fixed Income PM",
    content: "I hope to roll maturing notes into higher-yield munis without sacrificing credit quality.",
    likes_count: 37,
    created_at: daysAgo(19),
    hope_status: "in_progress",
  },
  {
    id: "seed-p-022",
    user_id: "seed-marcus",
    author_name: "Marcus Vance",
    author_avatar: "MC",
    job_role: "Fixed Income PM",
    content: "I want our income fund to deliver 5%+ yield with zero principal impairments this year.",
    likes_count: 88,
    created_at: daysAgo(26),
    hope_status: "fulfilled",
  },
];

export function generateSeedHopePosts(): HopePost[] {
  const posts = SEED_ENTRIES.map(({ id, ...rest }) => ({ id, ...rest }));
  return enrichHopePostsWithGeo(posts, DEFAULT_MAP_CENTER);
}

export function getSeedUserProfile(userId: string): HopeUserProfile | null {
  return USER_MAP[userId] ?? null;
}

export function profileFromPost(post: HopePost): HopeUserProfile {
  return (
    getSeedUserProfile(post.user_id) ?? {
      id: post.user_id,
      fullName: post.author_name,
      job_role: post.job_role ?? "Member",
      avatar:
        post.author_avatar ??
        post.author_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
    }
  );
}
