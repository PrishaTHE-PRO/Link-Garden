import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { stats } = await req.json();

  const thisMonthRanking = stats.thisMonthTop3.map(t => `${t.cat}(${t.n})`).join(', ') || 'none';
  const lastMonthRanking = stats.lastMonthTop3.map(t => `${t.cat}(${t.n})`).join(', ') || 'none';
  const topDomainsText   = stats.topDomains.map(d => `${d.d}(${d.n})`).join(', ') || 'none';
  const topSitesText     = stats.topSitesOverall.slice(0, 3).map(d => `${d.d}(${d.n})`).join(', ') || 'none';
  const catDomainsText   = stats.catTopDomains.slice(0, 4).map(c => `${c.cat}→${c.topDomain}(${c.count})`).join(', ') || 'none';

  const prompt = `Analyst for Link Garden (link-saving app). Return ONLY valid JSON, no markdown, no newlines inside string values.

Data:
- Top category: "${stats.dominantTheme}" (${stats.dominantThemeCount} links); sites: ${topDomainsText}
- Top sites overall: ${topSitesText}
- Per-category top site: ${catDomainsText}
- Style: ${stats.breadthLabel}, ${stats.totalCategories} cats, top cat=${stats.topCatShare}% of links
- Opened: ${stats.clickedLinks}/${stats.allTimeLinks} links (${stats.executionPct}%)
- This month: ${thisMonthRanking} | Last month: ${lastMonthRanking}
${stats.topNewCategory ? `- New breakout: "${stats.topNewCategory}" (${stats.topNewCategoryCount} links)` : ''}

Rules: second person ("You..."), 4-5 sentences per field, name actual domains, warm+perceptive tone, no generic phrases.
Season: spring=new/wide, summer=productive/hot, autumn=deep/focused, winter=slow/curated.

{"eraName":"poetic 2-5 word title for their current phase (NOT just the category name)","dominantTheme":"4-5 sentences: name every site from topDomainsText, why they return there, what it says about them now","breadthVsDepth":"4-5 sentences: use real numbers (${stats.totalCategories} cats, ${stats.topCatShare}%), what this reveals psychologically, name actual categories","executionRatio":"4-5 sentences: interpret ${stats.executionPct}% open rate, collector vs actor, what it says about their relationship with intention","driftDirection":"4-5 sentences: use real counts this month ${thisMonthRanking} vs last ${lastMonthRanking}, what the shift reveals about where they are in life","season":"spring|summer|autumn|winter","seasonReason":"one sentence why this season fits","song":"real well-known song matching their energy","artist":"artist name"}`;

  let rawResponse = '';
  try {
    const result = await flashModel.generateContent(prompt);
    rawResponse  = result.response.text();
    const raw    = rawResponse.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    // Replace all literal newlines/carriage returns with a space — safe because
    // JSON structural whitespace can be spaces, and string values must not have raw newlines
    const sanitized = raw.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    const parsed = JSON.parse(sanitized);

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
    console.error('Raw Gemini response was:', rawResponse.slice(0, 500));

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
