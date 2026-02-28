import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { url, existingClusters } = await req.json();

  // Step 1: fetch page metadata
  let title = url;
  let description = '';
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    const html = await response.text();
    title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() ?? url;
    description =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1] ?? '';
  } catch {
    // If the URL can't be fetched, use URL as title
  }

  const clusterList = existingClusters.length > 0
    ? existingClusters.join(', ')
    : 'none yet';

  // Step 2: ask Gemini for a plant name + cluster in one call
  try {
    const result = await flashModel.generateContent(
      `You organize saved links for a personal knowledge garden app.
Given this link, do two things:

1. Give it a short poetic plant name (3-5 words, like "Curious Mind Maps" or "Deep Ocean Facts") that captures the topic
2. Assign or create a cluster (2-4 words, Title Case)

Link title: ${title}
Link description: ${description}
Existing clusters: ${clusterList}

Respond ONLY in this format:
NAME: <plant name>
CLUSTER: <cluster name>`
    );

    const text = result.response.text().trim();
    const nameMatch    = text.match(/NAME:\s*(.+)/);
    const clusterMatch = text.match(/CLUSTER:\s*(.+)/);

    const plantName   = nameMatch?.[1]?.trim()    ?? cleanTitle(title);
    const clusterName = clusterMatch?.[1]?.trim() ?? 'General';

    return Response.json({ title, description, plantName, clusterName });
  } catch {
    // Gemini failed — use cleaned page title as plant name
    return Response.json({
      title,
      description,
      plantName: cleanTitle(title),
      clusterName: 'General',
    });
  }
}

function cleanTitle(raw) {
  // Strip HTML entities, trim, max 6 words
  return raw
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');
}
