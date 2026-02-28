import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { title, description, existingClusters } = await req.json();

  const clusterList = existingClusters.length > 0
    ? existingClusters.join(', ')
    : 'none yet';

  try {
    const result = await flashModel.generateContent(
      `You are a link organizer for a personal knowledge garden app.
Given a saved link, do two things:

1. Assign it to the best matching cluster from the list, OR create a new cluster name (2-5 words, Title Case)
2. Write a very short title for this link (4-7 words max, like a headline)

Link title: ${title}
Link description: ${description}
Existing clusters: ${clusterList}

Rules for cluster: if the link clearly fits an existing cluster, use that name exactly. Otherwise create a new 2-5 word name.
Rules for short title: make it punchy and descriptive, not just the page title.

Respond with ONLY this format (no extra text):
CLUSTER: <cluster name>
TITLE: <short title>`
    );

    const text = result.response.text().trim();
    const clusterMatch = text.match(/CLUSTER:\s*(.+)/);
    const titleMatch   = text.match(/TITLE:\s*(.+)/);

    const clusterName = clusterMatch?.[1]?.trim() ?? 'General';
    const shortTitle  = titleMatch?.[1]?.trim()   ?? title;

    return Response.json({ clusterName, shortTitle });
  } catch (err) {
    console.error('Gemini error, using fallback:', err.message);
    const shortTitle = title.split(' ').slice(0, 6).join(' ');
    return Response.json({ clusterName: 'General', shortTitle });
  }
}
