import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { stats } = await req.json();

  const momText = stats.monthOverMonth.length
    ? stats.monthOverMonth.map(m => `${m.category}: ${m.thisMonth} this month vs ${m.lastMonth} last (${m.change})`).join(', ')
    : 'not enough history yet';

  const thisMonthRanking = stats.thisMonthTop3.map(t => `${t.cat}(${t.n})`).join(', ') || 'none';
  const lastMonthRanking = stats.lastMonthTop3.map(t => `${t.cat}(${t.n})`).join(', ') || 'none';
  const topDomainsText   = stats.topDomains.map(d => `${d.d}(${d.n})`).join(', ') || 'none';
  const topSitesText     = stats.topSitesOverall.map(d => `${d.d}(${d.n})`).join(', ') || 'none';
  const catDomainsText   = stats.catTopDomains.map(c => `${c.cat}→${c.topDomain}(${c.count})`).join(', ') || 'none';

  const prompt = `You are an insightful analyst for a personal link-saving app called Link Garden.

User data:
- Dominant theme this month: "${stats.dominantTheme}" (${stats.dominantThemeCount} links); top sites within this category: ${topDomainsText}
- Most visited sites across all categories: ${topSitesText}
- Top site per category: ${catDomainsText}
- Garden style: ${stats.breadthLabel} — ${stats.totalCategories} categories, avg ${stats.avgLinksPerCat} links each; top category holds ${stats.topCatShare}% of all saved links
- Execution: ${stats.clickedLinks} of ${stats.allTimeLinks} saved links have actually been opened (${stats.executionPct}%)
- This month's top categories: ${thisMonthRanking}
- Last month's top categories: ${lastMonthRanking}
- Momentum by category: ${momText}
- Top categories overall: ${stats.topCategories.join(', ')}
${stats.topNewCategory ? `- Breakout new category this month: "${stats.topNewCategory}" (${stats.topNewCategoryCount} links)` : ''}

Return ONLY a valid JSON object with exactly these 9 keys. Values for the sentence fields should be 3-4 rich, personal sentences in second person ("You..."). Be warm, specific, and insightful. NAME the actual websites and stores (e.g. "aerie.com", "github.com") — never just say "a site" or "various sources". Reference real category names and real domain names from the data above.

Season guide (pick the ONE that best fits this user right now):
- "spring": new explorer, lots of new categories, fresh growth, wide breadth, just starting out
- "summer": peak productivity, high execution ratio, hot streak, dominant theme blazing, energetic
- "autumn": deep focused interests, staying the course, lots of depth per category, harvesting knowledge
- "winter": reflective, narrow intentional focus, low recent activity, minimal but curated

Song guide: pick ONE real, well-known song that perfectly mirrors this user's personality and current browsing energy. Match the mood — not just the topic. Think about the feeling, pace, and energy of their link-saving behavior.

{
  "eraName": "A creative, evocative 2-5 word era title that captures this user's current phase — poetic and original, NOT just the category name. Examples: 'The Deep Research Phase', 'The Renaissance Builder', 'The Quiet Collector', 'The Obsessive Learner Era'. Make it feel personal and cinematic.",
  "dominantTheme": "3-4 sentences about their dominant focus. Name the specific sites they keep returning to (from topDomainsText). What does gravitating toward these sites say about them right now?",
  "breadthVsDepth": "3-4 sentences about their ${stats.breadthLabel} style. Use the real numbers (${stats.totalCategories} categories, ${stats.topCatShare}% of links in top category). Describe what this pattern reveals about how they consume information.",
  "executionRatio": "3-4 sentences interpreting their ${stats.executionPct}% link open rate. Are they a collector who hoards but never revisits, or someone who actually acts on what they save? What does this say about their relationship with information?",
  "driftDirection": "3-4 sentences describing exactly how their interests shifted. Use real category names and counts: this month ${thisMonthRanking} vs last month ${lastMonthRanking}. What does this shift reveal about where their head is at?",
  "season": "spring|summer|autumn|winter",
  "seasonReason": "One sentence explaining exactly why this season fits their personality right now",
  "song": "A real song title that matches this user's personality and current energy",
  "artist": "The artist or band name"
}

Return ONLY the JSON. No markdown fences, no explanation.`;

  try {
    const result = await flashModel.generateContent(prompt);
    const raw    = result.response.text().trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(raw);

    const keys = ['eraName', 'dominantTheme', 'breadthVsDepth', 'executionRatio', 'driftDirection', 'season', 'seasonReason', 'song', 'artist'];
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
          ? `You've opened ${stats.executionPct}% of your saved links — you're not just collecting, you're actually using them.`
          : 'Your links are waiting to be explored — every journey starts with the first click.',
        driftDirection: stats.lastMonthTopCat && stats.lastMonthTopCat !== stats.dominantTheme
          ? `Your curiosity has drifted from ${stats.lastMonthTopCat} toward ${stats.dominantTheme} — a new chapter is unfolding.`
          : `You've stayed loyal to your interests — consistency is its own kind of wisdom.`,
        season,
        seasonReason: `Your link-saving patterns have the energy of ${season} — steady, intentional, and full of quiet momentum.`,
        song:   'Pursuit of Happiness',
        artist: 'Kid Cudi',
      },
    });
  }
}
