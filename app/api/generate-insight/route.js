import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { stats } = await req.json();

  try {
    const result = await flashModel.generateContent(
      `You are an insightful analyst for a personal link-saving app called Link Garden.
A user's browsing behavior produced these stats:

Clusters: ${stats.topClusters.join(', ')}
Links saved: ${stats.linkCountThisMonth}
New clusters formed: ${stats.newClustersThisMonth}
Breadth score: ${stats.breadthScore} (0 = narrow focus, 1 = very broad curiosity)
Depth score: ${stats.depthScore} (average links per cluster — higher = more focused)

Write a 2-3 sentence personality insight in second person ("You...").
Be warm, specific, and perceptive. Reference the actual cluster names.
No bullet points. No headers. Just the paragraph.`
    );

    const insight = result.response.text().trim();
    return Response.json({ insight });
  } catch (err) {
    console.error('Gemini insight error:', err.message);
    return Response.json({
      insight: `You've saved ${stats.linkCountThisMonth} links across ${stats.topClusters.length} topics. Your garden is growing — keep exploring!`,
    });
  }
}
