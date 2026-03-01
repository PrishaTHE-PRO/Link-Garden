import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { stats } = await req.json();

  const momText = stats.monthOverMonth.length
    ? stats.monthOverMonth.map(m => `${m.category}: ${m.thisMonth} this month vs ${m.lastMonth} last (${m.change})`).join(', ')
    : 'not enough history yet';

  const prompt = `You are an insightful analyst for a personal link-saving app called Link Garden.

User data:
- Dominant theme this month: "${stats.dominantTheme}" (${stats.dominantThemeCount} links)
- Garden style: ${stats.breadthLabel} — ${stats.totalCategories} categories, avg ${stats.avgLinksPerCat} links each
- Activity: ${stats.thisMonthLinks} of ${stats.allTimeLinks} all-time links saved this month (${stats.executionPct}%)
- Drift: last month's top was "${stats.lastMonthTopCat || 'none'}", this month's is "${stats.dominantTheme}"
- Momentum by category: ${momText}
- Top categories overall: ${stats.topCategories.join(', ')}
${stats.topNewCategory ? `- Breakout new category this month: "${stats.topNewCategory}" (${stats.topNewCategoryCount} links)` : ''}

Return ONLY a valid JSON object with exactly these 7 keys. Values for the sentence fields should be 1-2 punchy sentences in second person ("You..."). Be warm, specific, and slightly witty. Reference actual category names.

Season guide (pick the ONE that best fits this user right now):
- "spring": new explorer, lots of new categories, fresh growth, wide breadth, just starting out
- "summer": peak productivity, high execution ratio, hot streak, dominant theme blazing, energetic
- "autumn": deep focused interests, staying the course, lots of depth per category, harvesting knowledge
- "winter": reflective, narrow intentional focus, low recent activity, minimal but curated

{
  "eraName": "A creative, evocative 2-5 word era title that captures this user's current phase — poetic and original, NOT just the category name. Examples: 'The Deep Research Phase', 'The Renaissance Builder', 'The Quiet Collector', 'The Obsessive Learner Era'. Make it feel personal and cinematic.",
  "dominantTheme": "A sentence about the era they're in and what it says about them right now",
  "breadthVsDepth": "A sentence about whether they explore widely or go deep — use their ${stats.breadthLabel} style and numbers",
  "executionRatio": "A sentence interpreting their ${stats.executionPct}% — hot streak, just starting, or cooling off",
  "driftDirection": "A sentence about how their interests have or haven't shifted from last month to now",
  "season": "spring|summer|autumn|winter",
  "seasonReason": "One sentence explaining exactly why this season fits their personality right now"
}

Return ONLY the JSON. No markdown fences, no explanation.`;

  try {
    const result = await flashModel.generateContent(prompt);
    const raw    = result.response.text().trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(raw);

    const keys = ['eraName', 'dominantTheme', 'breadthVsDepth', 'executionRatio', 'driftDirection', 'season', 'seasonReason'];
    for (const k of keys) {
      if (typeof parsed[k] !== 'string') throw new Error(`Missing key: ${k}`);
    }
    if (!['spring', 'summer', 'autumn', 'winter'].includes(parsed.season)) {
      parsed.season = 'spring';
    }

    return Response.json({ report: parsed });
  } catch (err) {
    console.error('Gemini report error:', err.message);

    // Compute fallback season from stats
    let season = 'spring';
    if (stats.executionPct > 40)                             season = 'summer';
    else if (stats.avgLinksPerCat >= 5)                      season = 'autumn';
    else if (stats.allTimeLinks > 20 && stats.executionPct < 10) season = 'winter';

    return Response.json({
      report: {
        eraName:        `The ${stats.dominantTheme} Deep Dive`,
        dominantTheme:  `You're deep in your ${stats.dominantTheme} era, with ${stats.dominantThemeCount} links saved there this month alone.`,
        breadthVsDepth: `With ${stats.totalCategories} categories and ${stats.avgLinksPerCat} links on average, you're a ${stats.breadthLabel} at heart.`,
        executionRatio: stats.executionPct > 0
          ? `${stats.executionPct}% of your all-time links were saved this month — you're clearly on a roll.`
          : 'Your garden is just getting started — every great collection begins with a single link.',
        driftDirection: stats.lastMonthTopCat && stats.lastMonthTopCat !== stats.dominantTheme
          ? `Your curiosity has drifted from ${stats.lastMonthTopCat} toward ${stats.dominantTheme} — a new chapter is unfolding.`
          : `You've stayed loyal to your interests — consistency is its own kind of wisdom.`,
        season,
        seasonReason: `Your link-saving patterns have the energy of ${season} — steady, intentional, and full of quiet momentum.`,
      },
    });
  }
}
