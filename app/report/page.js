'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '../../lib/firebase';

const auth = getAuth(app);
const db   = getFirestore(app);

function getTimestamp(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

const CARDS = [
  { key: 'dominantTheme',  emoji: '🌟', label: 'Dominant Theme'   },
  { key: 'breadthVsDepth', emoji: '🌿', label: 'Breadth vs Depth' },
  { key: 'executionRatio', emoji: '⚡', label: 'Execution Ratio'  },
  { key: 'driftDirection', emoji: '🧭', label: 'Drift Direction'  },
];

const SEASONS = {
  spring: {
    emoji: '🌸',
    label: 'Spring',
    background: 'linear-gradient(180deg, #fce4ec 0%, #f8bbd0 25%, #e8f5e9 100%)',
    front: 'rgba(252,220,235,0.9)',
    border: 'rgba(240,160,200,0.6)',
    nameColor: '#ad1457',
    back: 'linear-gradient(120deg, #f48fb1 30%, #f06292 88%, #fce4ec 40%, #e91e63 78%)',
  },
  summer: {
    emoji: '☀️',
    label: 'Summer',
    background: 'linear-gradient(180deg, #e3f2fd 0%, #c9e8f7 35%, #fff9c4 100%)',
    front: 'rgba(255,248,200,0.9)',
    border: 'rgba(255,220,80,0.6)',
    nameColor: '#e65100',
    back: 'linear-gradient(120deg, #ffcc02 30%, #ff8f00 88%, #fff9c4 40%, #ffb300 78%)',
  },
  autumn: {
    emoji: '🍂',
    label: 'Autumn',
    background: 'linear-gradient(180deg, #fff8e1 0%, #ffe0b2 45%, #ffccbc 100%)',
    front: 'rgba(255,228,185,0.9)',
    border: 'rgba(255,160,80,0.6)',
    nameColor: '#bf360c',
    back: 'linear-gradient(120deg, #ff8a65 30%, #e64a19 88%, #ffccbc 40%, #ff7043 78%)',
  },
  winter: {
    emoji: '❄️',
    label: 'Winter',
    background: 'linear-gradient(180deg, #e8eaf6 0%, #c5cae9 45%, #e3f2fd 100%)',
    front: 'rgba(220,228,250,0.9)',
    border: 'rgba(160,185,235,0.6)',
    nameColor: '#1a237e',
    back: 'linear-gradient(120deg, #5c6bc0 30%, #3949ab 88%, #e3f2fd 40%, #3f51b5 78%)',
  },
};

function funnyDriftLine(categoryName) {
  const c = (categoryName || '').toLowerCase();
  if (c.includes('shopping'))    return 'You are becoming a fashionista this month.';
  if (c.includes('research'))    return 'You are in full detective mode this month.';
  if (c.includes('internship'))  return 'Career arc unlocked: internship era in progress.';
  if (c.includes('news'))        return 'Breaking news: you are the newsroom now.';
  if (c.includes('hobby'))       return 'Hobby hero energy is strong this month.';
  if (c.includes('youtube'))     return 'You are in your main-character binge era.';
  if (c.includes('coding') || c.includes('programming') || c.includes('tech')) {
    return 'You are speedrunning your tech glow-up this month.';
  }
  return `Plot twist: you are clearly obsessed with ${categoryName} right now.`;
}

export default function ReportPage() {
  const [user,          setUser]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [report,        setReport]        = useState(null);
  const [computed,      setComputed]      = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          const saved = localStorage.getItem(`lg_report_${u.uid}`);
          if (saved) {
            const { report: r, computed: c } = JSON.parse(saved);
            setReport(r);
            setComputed(c);
          }
        } catch {}
      }
    });
    return unsub;
  }, []);

  // Change the page background when a season is determined
  useEffect(() => {
    const season = report?.season;
    if (!season || !SEASONS[season]) return;
    const prev = document.body.style.background;
    document.body.style.background = SEASONS[season].background;
    return () => { document.body.style.background = prev; };
  }, [report?.season]);

  async function generateReport() {
    if (!user) return;
    setReportLoading(true);
    try {
      const now            = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [linksSnap, catsSnap] = await Promise.all([
        getDocs(query(collection(db, 'links'),      where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'categories'), where('uid', '==', user.uid))),
      ]);

      const links      = linksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const thisMonthLinks = links.filter(l => { const d = getTimestamp(l.savedAt); return d && d >= thisMonthStart; });
      const lastMonthLinks = links.filter(l => { const d = getTimestamp(l.savedAt); return d && d >= lastMonthStart && d <= lastMonthEnd; });

      const thisMonthByCat = {};
      const lastMonthByCat = {};
      const allByCat       = {};
      for (const link of links)          allByCat[link.categoryName]       = (allByCat[link.categoryName]       || 0) + 1;
      for (const link of thisMonthLinks) thisMonthByCat[link.categoryName] = (thisMonthByCat[link.categoryName] || 0) + 1;
      for (const link of lastMonthLinks) lastMonthByCat[link.categoryName] = (lastMonthByCat[link.categoryName] || 0) + 1;

      const thisMonthEntries = Object.entries(thisMonthByCat).sort((a, b) => b[1] - a[1]);
      const allTimeEntries   = Object.entries(allByCat).sort((a, b) => b[1] - a[1]);
      const eraName          = thisMonthEntries[0]?.[0] ?? allTimeEntries[0]?.[0] ?? categories[0]?.name ?? 'General';
      const eraLinkCount     = thisMonthEntries[0]?.[1] ?? allTimeEntries[0]?.[1] ?? 0;

      const avgLinksPerCat = links.length / Math.max(categories.length, 1);
      const topCatAllTime  = allTimeEntries[0]?.[1] ?? 0;
      const topCatShare    = links.length > 0 ? topCatAllTime / links.length : 0;
      let breadthLabel;
      if (categories.length >= 6 && topCatShare < 0.35)      breadthLabel = 'Wide Explorer';
      else if (topCatShare >= 0.6 || avgLinksPerCat >= 8)    breadthLabel = 'Deep Diver';
      else if (categories.length <= 3 || avgLinksPerCat >= 5) breadthLabel = 'Focused & Deep';
      else                                                    breadthLabel = 'Balanced Curator';

      // Top domains within the dominant category
      const dominantCatLinks = links.filter(l => l.categoryName === eraName);
      const domainCounts = {};
      for (const link of dominantCatLinks) {
        try {
          const domain = new URL(link.url).hostname.replace(/^www\./, '');
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        } catch {}
      }
      const domainEntries = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
      const topDomains    = domainEntries.slice(0, 3).map(([d, n]) => ({ d, n }));

      // Top sites across all links
      const allDomainCounts = {};
      for (const link of links) {
        try {
          const domain = new URL(link.url).hostname.replace(/^www\./, '');
          allDomainCounts[domain] = (allDomainCounts[domain] || 0) + 1;
        } catch {}
      }
      const topSitesOverall = Object.entries(allDomainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([d, n]) => ({ d, n }));

      // Top domain per category
      const catDomainMap = {};
      for (const link of links) {
        try {
          const domain = new URL(link.url).hostname.replace(/^www\./, '');
          if (!catDomainMap[link.categoryName]) catDomainMap[link.categoryName] = {};
          catDomainMap[link.categoryName][domain] = (catDomainMap[link.categoryName][domain] || 0) + 1;
        } catch {}
      }
      const catTopDomains = Object.entries(catDomainMap).map(([cat, counts]) => {
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return { cat, topDomain: top?.[0], count: top?.[1] };
      }).filter(x => x.topDomain);

      const clickedLinks   = links.filter(l => (l.clickCount || 0) > 0);
      const executionPct   = links.length > 0 ? Math.round((clickedLinks.length / links.length) * 100) : 0;
      const executionValue = links.length > 0 ? `${executionPct}% of links opened` : 'Just getting started';
      const openedByCat = {};
      for (const link of thisMonthLinks) {
        const opens = Number(link.clickCount || 0);
        if (!link.categoryName || opens <= 0) continue;
        openedByCat[link.categoryName] = (openedByCat[link.categoryName] || 0) + opens;
      }
      const openedEntries = Object.entries(openedByCat).sort((a, b) => b[1] - a[1]);
      const topOpenedCategoryThisMonth = openedEntries[0]?.[0] || null;
      const topOpenedCountThisMonth = openedEntries[0]?.[1] || 0;

      const lastMonthEntries = Object.entries(lastMonthByCat).sort((a, b) => b[1] - a[1]);
      const lastMonthTopCat  = lastMonthEntries[0]?.[0] ?? null;
      let driftValue;
      if (openedEntries.length >= 2) {
        const [topCategory, topCount] = openedEntries[0];
        const [, secondCount] = openedEntries[1];
        driftValue = topCount > secondCount
          ? funnyDriftLine(topCategory)
          : 'Your curiosity is having a tie game this month.';
      } else if (openedEntries.length === 1) {
        driftValue = funnyDriftLine(openedEntries[0][0]);
      } else if (!lastMonthTopCat) {
        driftValue = 'Finding your path';
      } else if (lastMonthTopCat === eraName) {
        driftValue = `No category switch-up. Still deep in your ${eraName} era.`;
      } else {
        driftValue = `From ${lastMonthTopCat} to ${eraName}: your curiosity had a dramatic plot twist.`;
      }

      const newCats = categories.filter(c => { const d = getTimestamp(c.createdAt); return d && d >= thisMonthStart; });
      let topNewCategory = null, topNewCategoryCount = 0;
      for (const cat of newCats) {
        const count = thisMonthByCat[cat.name] || 0;
        if (count > topNewCategoryCount) { topNewCategory = cat.name; topNewCategoryCount = count; }
      }

      const topCategories  = allTimeEntries.slice(0, 5).map(([name]) => name);
      const monthOverMonth = [...new Set([...Object.keys(thisMonthByCat), ...Object.keys(lastMonthByCat)])]
        .map(cat => ({
          category: cat,
          thisMonth: thisMonthByCat[cat] || 0,
          lastMonth: lastMonthByCat[cat] || 0,
          change: lastMonthByCat[cat]
            ? `${Math.round((((thisMonthByCat[cat] || 0) - lastMonthByCat[cat]) / lastMonthByCat[cat]) * 100)}%`
            : 'new',
        }))
        .sort((a, b) => b.thisMonth - a.thisMonth).slice(0, 5);

      const thisMonthTop3 = thisMonthEntries.slice(0, 3).map(([cat, n]) => ({ cat, n }));
      const lastMonthTop3 = lastMonthEntries.slice(0, 3).map(([cat, n]) => ({ cat, n }));

      const newComputed = { themeValue: eraName, breadthValue: breadthLabel, executionValue, driftValue };
      setComputed(newComputed);

      const stats = {
        dominantTheme: eraName, dominantThemeCount: eraLinkCount,
        topDomains, topSitesOverall, catTopDomains,
        breadthLabel, totalCategories: categories.length, avgLinksPerCat: avgLinksPerCat.toFixed(1),
        topCatShare: Math.round(topCatShare * 100),
        executionPct, clickedLinks: clickedLinks.length, allTimeLinks: links.length,
        lastMonthTopCat, thisMonthTop3, lastMonthTop3,
        topCategories, monthOverMonth, topNewCategory, topNewCategoryCount,
        topOpenedCategoryThisMonth, topOpenedCountThisMonth,
      };

      const res  = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      const data = await res.json();
      const driftAccessLine = topOpenedCategoryThisMonth
        ? ` This month, you accessed ${topOpenedCategoryThisMonth} the most (${topOpenedCountThisMonth} opens).`
        : '';
      setReport({
        ...data.report,
        driftDirection: `${data.report.driftDirection || ''}${driftAccessLine}`.trim(),
      });
      try {
        localStorage.setItem(`lg_report_${user.uid}`, JSON.stringify({ report: data.report, computed: newComputed }));
      } catch {}
    } catch (err) {
      console.error(err);
      setReport({
        dominantTheme:  'Your garden has a clear dominant theme taking root this month.',
        breadthVsDepth: 'Your link-saving style shows a unique blend of exploration and focus.',
        executionRatio: 'You\'ve been actively growing your collection — keep the momentum going.',
        driftDirection: 'Your curiosity is finding its direction.',
        season:         'spring',
        seasonReason:   'Every garden starts somewhere — yours is just beginning to bloom.',
      });
    } finally {
      setReportLoading(false);
    }
  }

  if (loading) return null;

  const season = report?.season && SEASONS[report.season] ? SEASONS[report.season] : null;

  return (
    <>
      <Clouds />
      <div className="report-page">
        <header>
          <span style={{ fontSize: 22 }}>🌿</span>
          <span className="logo">Link Garden</span>
          <Link href="/" className="btn-logout" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
            ← Back to garden
          </Link>
        </header>

        <div className="report-card">
          {!user ? (
            <p style={{ color: '#5a8a5a', textAlign: 'center' }}>Please sign in to view your personality report.</p>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <h1 className="report-title">Personality Report</h1>
                <p className="report-subtitle">What your saved links say about you.</p>
              </div>

              {report && computed && season ? (
                <>
                  {/* Top row: Song card + Season flip card */}
                  <div className="report-top-row">
                    {/* Song card */}
                    <div className="song-card">
                      <div className="song-logo">
                        <span className="song-icon">🎵</span>
                        <span className="song-label">Your Soundtrack</span>
                      </div>
                      <div className="song-details">
                        <a
                          href={`https://open.spotify.com/search/${encodeURIComponent(`${report.song} ${report.artist}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="song-link"
                        >
                          {report.song}
                        </a>
                        <span>{report.artist}</span>
                      </div>
                    </div>

                    {/* Season flip card */}
                    <div className="flip-card">
                      <div className="flip-card-inner">
                        <div className="flip-card-front" style={{ background: season.front, border: `1px solid ${season.border}` }}>
                          <span className="flip-season-emoji">{season.emoji}</span>
                          <p className="flip-season-name" style={{ color: season.nameColor }}>{season.label}</p>
                        </div>
                        <div className="flip-card-back" style={{ background: season.front, border: `1px solid ${season.border}` }}>
                          <p className="flip-season-reason" style={{ color: season.nameColor }}>{report.seasonReason}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4 personality cards */}
                  <div className="report-sections">
                    {CARDS.map(({ key, emoji, label }) => (
                      <div key={key} className="report-section-card">
                        <div className="report-section-label">{emoji} {label}</div>
                        <div className="report-section-value">
                          {key === 'dominantTheme'  && report.eraName}
                          {key === 'breadthVsDepth' && computed.breadthValue}
                          {key === 'executionRatio' && computed.executionValue}
                          {key === 'driftDirection' && computed.driftValue}
                        </div>
                        <p className="report-section-text">{report[key]}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="report-placeholder">
                  <span style={{ fontSize: 52 }}>🔮</span>
                  <p>Generate a personalized report based on your curiosity patterns and link-saving habits.</p>
                </div>
              )}

              <button
                className="btn-primary report-btn"
                onClick={generateReport}
                disabled={reportLoading}
              >
                {reportLoading ? '✨ Analyzing your garden…' : report ? '✨ Regenerate Report' : '✨ Generate Personality Report'}
              </button>
            </>
          )}
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
