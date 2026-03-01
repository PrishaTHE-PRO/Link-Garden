export async function POST(req) {
  const { url } = await req.json();

  try {
    const isBlockedTitle = (title) => {
      if (!title || typeof title !== 'string') return true;
      return /client challenge|just a moment|attention required|captcha|verify you are human|are you human/i.test(title);
    };

    const isChallengeHtml = (html) => {
      return /cf-challenge|cf-browser-verification|cloudflare|captcha|challenge-platform/i.test(html);
    };

    const getYouTubeTitle = async (inputUrl, parsedUrl) => {
      const host = parsedUrl.hostname.toLowerCase();
      const isYoutube = host.includes('youtube.com') || host.includes('youtu.be');
      if (!isYoutube) return '';

      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(inputUrl)}&format=json`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!oembed.ok) return '';
        const data = await oembed.json();
        return typeof data?.title === 'string' ? data.title.trim() : '';
      } catch {
        return '';
      }
    };

    const extractProductName = (html) => {
      const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const match of scripts) {
        const raw = match[1]?.trim();
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const nodes = Array.isArray(parsed)
            ? parsed
            : parsed?.['@graph'] && Array.isArray(parsed['@graph'])
              ? parsed['@graph']
              : [parsed];

          for (const node of nodes) {
            const type = Array.isArray(node?.['@type']) ? node['@type'].join(',') : node?.['@type'];
            if (type && /Product/i.test(type) && typeof node?.name === 'string' && node.name.trim()) {
              return node.name.trim();
            }
          }
        } catch {}
      }
      return '';
    };

    const parsedUrl = new URL(url);
    const youtubeTitle = await getYouTubeTitle(url, parsedUrl);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await response.text();

    const productTitle = extractProductName(html);
    const fallbackTitle =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i)?.[1]?.trim() ??
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:title["']/i)?.[1]?.trim() ??
      html.match(/<meta[^>]*name=["']title["'][^>]*content=["'](.*?)["']/i)?.[1]?.trim() ??
      html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() ??
      url;

    const title = productTitle || youtubeTitle || fallbackTitle;
    const description =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1] ?? '';

    const iconHref =
      html.match(/<link[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["'](.*?)["']/i)?.[1] ??
      html.match(/<link[^>]*href=["'](.*?)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i)?.[1] ??
      html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["'](.*?)["']/i)?.[1] ??
      html.match(/<link[^>]*href=["'](.*?)["'][^>]*rel=["'][^"']*icon[^"']*["']/i)?.[1] ??
      '/favicon.ico';

    const iconUrl = new URL(iconHref, parsedUrl.origin).toString();
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    const sanitizedTitle = (isBlockedTitle(title) || isChallengeHtml(html)) ? url : title;

    return Response.json({ title: sanitizedTitle, description, bodyText, iconUrl });
  } catch {
    // If fetch fails (CORS, timeout, etc.) just use the URL itself
    let iconUrl = '';
    try {
      iconUrl = `${new URL(url).origin}/favicon.ico`;
    } catch {}

    return Response.json({ title: url, description: '', bodyText: '', iconUrl });
  }
}
