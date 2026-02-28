export async function POST(req) {
  const { url } = await req.json();

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await response.text();

    const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() ?? url;
    const description =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1] ?? '';

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    return Response.json({ title, description, bodyText });
  } catch {
    // If fetch fails (CORS, timeout, etc.) just use the URL itself
    return Response.json({ title: url, description: '', bodyText: '' });
  }
}
