import { flashModel } from '../../../lib/ai';

export async function POST(req) {
  const { links } = await req.json();

  const linkList = links
    .map((l, i) => `${i + 1}. ${l.title} — ${l.description}`)
    .join('\n');

  const result = await flashModel.generateContent(
    `You name clusters of saved links for a personal knowledge garden app.
Return ONLY a short cluster name (2-5 words, title case). No explanation, no punctuation.

Name this cluster of saved links:

${linkList}`
  );

  const clusterName = result.response.text().trim();
  return Response.json({ clusterName });
}
