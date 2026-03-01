'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, where } from 'firebase/firestore';
import { app } from '../../../lib/firebase';

const auth = getAuth(app);
const db   = getFirestore(app);

const CATEGORY_THEMES = {
  internships: {
    accent: 'rgb(63, 121, 230)',
    image: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    emoji: 'IN',
  },
  research: {
    accent: 'rgb(16, 185, 129)',
    image: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    emoji: 'RS',
  },
  shopping: {
    accent: 'rgb(236, 72, 153)',
    image: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    emoji: 'SH',
  },
  hobbies: {
    accent: 'rgb(245, 158, 11)',
    image: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    emoji: 'HB',
  },
  news: {
    accent: 'rgb(107, 114, 128)',
    image: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
    emoji: 'NW',
  },
};

const FALLBACK_THEMES = [
  { accent: 'rgb(14, 165, 233)', image: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', emoji: 'LG' },
  { accent: 'rgb(34, 197, 94)', image: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', emoji: 'CT' },
  { accent: 'rgb(168, 85, 247)', image: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', emoji: 'FX' },
  { accent: 'rgb(239, 68, 68)', image: 'linear-gradient(135deg, #fee2e2, #fecaca)', emoji: 'BK' },
];

function getCategoryTheme(name) {
  const key = (name || '').trim().toLowerCase();
  if (CATEGORY_THEMES[key]) return CATEGORY_THEMES[key];

  const hash = key.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return FALLBACK_THEMES[hash % FALLBACK_THEMES.length];
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getSavedText(savedAt) {
  const stamp = savedAt?.toDate ? savedAt.toDate() : new Date(savedAt || Date.now());
  const diffMs = Date.now() - stamp.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(0, Math.floor(diffMs / dayMs));

  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function humanizeSlug(value) {
  if (!value) return '';
  return decodeURIComponent(value)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromUrl(url, categoryName = '') {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const lowerCategory = (categoryName || '').toLowerCase();
    const isLinkedIn = host.includes('linkedin.com');
    const isResearch = lowerCategory === 'research';

    // LinkedIn job links often contain "jobs/view/<title>-at-<company>-<id>"
    if (isLinkedIn && pathParts.includes('jobs')) {
      const joined = pathParts.join('/');
      const match = joined.match(/jobs\/view\/([^/?#]+)/i);
      const raw = match?.[1] || pathParts[pathParts.length - 1] || '';
      let clean = humanizeSlug(raw);

      clean = clean
        .replace(/\s+at\s+.+$/i, '')
        .replace(/\s+\d{4,}\s*$/i, '')
        .trim();

      if (clean && /[a-z]/i.test(clean)) return clean;
    }

    // Research URLs often have useful slugs in the final segment.
    if (isResearch) {
      const candidate = pathParts
        .slice()
        .reverse()
        .find((part) => /[a-z]/i.test(part) && !/^\d+(\.\d+)?$/.test(part));
      const clean = humanizeSlug(candidate || '');
      if (clean) return clean;
    }

    const ignored = new Set([
      'jobs', 'job', 'view', 'in', 'company', 'careers', 'search', 'results',
      'abs', 'pdf', 'article', 'papers', 'paper', 'publication', 'publications',
    ]);
    const candidate = pathParts
      .slice()
      .reverse()
      .find((part) => /[a-z]/i.test(part) && !ignored.has(part.toLowerCase()));
    if (!candidate) return host;

    const clean = humanizeSlug(candidate);
    const lower = clean.toLowerCase();
    const looksGeneric = ['watch', 'item', 'product', 'dp', 'gp', 'p', 'shop'].includes(lower);

    return !clean || looksGeneric ? host : clean;
  } catch {
    return url;
  }
}

function normalizeTitle(rawTitle, url) {
  if (!rawTitle || rawTitle === url) return '';
  const host = getHost(url);
  const hostNoTld = host.split('.')[0];
  const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedHostNoTld = hostNoTld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = rawTitle
    .replace(/\s+/g, ' ')
    .replace(new RegExp(`\\s*[-|:•·]\\s*${escapedHost}$`, 'i'), '')
    .replace(new RegExp(`\\s*[-|:•·]\\s*${escapedHostNoTld}$`, 'i'), '')
    .trim();

  return cleaned || rawTitle.trim();
}

function cleanShoppingTitle(title) {
  if (!title || typeof title !== 'string') return title;

  return title
    .replace(/\s*[-|:•·]\s*\d{2,}\s*$/i, '')
    .replace(/\s+\d{2,}\s*$/i, '')
    .trim();
}
export default function CategoryPage() {
  const params           = useParams();
  const categoryName     = decodeURIComponent(params.name);
  const [links, setLinks] = useState(null);
  const [metaById, setMetaById] = useState({});
  const theme = getCategoryTheme(categoryName);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'links'),
      where('uid', '==', user.uid),
      where('categoryName', '==', categoryName),
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.savedAt?.seconds ?? 0) - (a.savedAt?.seconds ?? 0));
      setLinks(rows);
    });

    return unsub;
  }, [categoryName]);

  useEffect(() => {
    if (!links || links.length === 0) return;

    let cancelled = false;
    const missing = links.filter(link => !metaById[link.id]);

    missing.forEach(async (link) => {
      try {
        const res = await fetch('/api/fetch-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link.url }),
        });
        const data = await res.json();

        if (cancelled) return;
        setMetaById((prev) => {
          if (prev[link.id]) return prev;
          return {
            ...prev,
            [link.id]: {
              title: data?.title || link.url,
              iconUrl: data?.iconUrl || '',
            },
          };
        });
      } catch {
        if (cancelled) return;
        setMetaById((prev) => {
          if (prev[link.id]) return prev;
          return {
            ...prev,
            [link.id]: {
              title: link.url,
              iconUrl: '',
            },
          };
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [links, metaById]);
  return (
    <>
      <Clouds />
      <div className="detail-page">
        <header>
          <span style={{ fontSize: 22 }}>🌿</span>
          <span className="logo">Link Garden</span>
        </header>

        <div className="detail-card">
          <Link href="/" className="detail-back">← Back to garden</Link>

          <div className="detail-box">
            <span className="detail-cluster">{categoryName}</span>
            <h1 className="detail-title">Your Links</h1>

            {links === null ? (
              <p style={{ color: '#7aaa7a' }}>Loading…</p>
            ) : links.length === 0 ? (
              <p style={{ color: '#7aaa7a', fontStyle: 'italic' }}>No links yet in this category.</p>
            ) : (
              <div className="category-link-bento">
                {links.map((link, idx) => {
                  const meta = metaById[link.id];
                  const host = getHost(link.url);
                  const fetchedTitle = normalizeTitle(meta?.title || '', link.url);
                  const fallbackTitle = titleFromUrl(link.url, categoryName);
                  const baseTitle = fetchedTitle || fallbackTitle;
                  const title = categoryName.toLowerCase() === 'shopping'
                    ? cleanShoppingTitle(baseTitle)
                    : baseTitle;
                  const fallbackIcon = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(link.url)}`;
                  const logoSrc = meta?.iconUrl || fallbackIcon;

                  return (
                    <article
                      key={link.id}
                      className={`uiverse-card bento-item bento-${idx % 6}`}
                      style={{
                        '--uiverse-accent': theme.accent,
                        '--uiverse-image': theme.image,
                      }}
                    >
                    <div className="uiverse-card-image">
                      <span className="uiverse-card-logo-fallback">{theme.emoji}</span>
                      <img
                        src={logoSrc}
                        alt={`${host} logo`}
                        className="uiverse-card-logo"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="uiverse-category">{categoryName}</div>
                    <div className="uiverse-heading">
                      {title}
                      <div className="uiverse-author">
                        By <span className="uiverse-name">You</span> {getSavedText(link.savedAt)}
                      </div>
                    </div>
                    <div className="uiverse-actions">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="category-link-item"
                      >
                        Open link
                      </a>
                    </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Clouds() {
  return (
    <>
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <div key={n} className={`cloud cloud-${n}`} />
      ))}
    </>
  );
}
