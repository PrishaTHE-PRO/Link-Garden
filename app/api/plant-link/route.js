export async function POST(req) {
  const { url } = await req.json();

  // Fetch page metadata
  let title = url;
  let description = '';
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3000),
    });
    const html = await response.text();
    title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() ?? url;
    description =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1] ?? '';
  } catch {
    // If the URL can't be fetched, fall back to the URL string
  }

  // Use domain as cluster (fast, no AI needed)
  const clusterName = domainCluster(url);

  // Clean the page title as the plant name (max 6 words, no HTML entities)
  const plantName = cleanTitle(title);

  return Response.json({ title, description, plantName, clusterName });
}

function domainCluster(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const label = host.split('.')[0];
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'General';
  }
}

function cleanTitle(raw) {
  return raw
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');
}
