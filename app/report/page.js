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
    banner: 'rgba(252,220,235,0.75)',
    border: 'rgba(240,160,200,0.5)',
    nameColor: '#ad1457',
  },
  summer: {
    emoji: '☀️',
    label: 'Summer',
    background: 'linear-gradient(180deg, #e3f2fd 0%, #c9e8f7 35%, #fff9c4 100%)',
    banner: 'rgba(255,248,200,0.75)',
    border: 'rgba(255,220,80,0.5)',
    nameColor: '#e65100',
  },
  autumn: {
    emoji: '🍂',
    label: 'Autumn',
    background: 'linear-gradient(180deg, #fff8e1 0%, #ffe0b2 45%, #ffccbc 100%)',
    banner: 'rgba(255,228,185,0.75)',
    border: 'rgba(255,160,80,0.5)',
    nameColor: '#bf360c',
  },
  winter: {
    emoji: '❄️',
    label: 'Winter',
    background: 'linear-gradient(180deg, #e8eaf6 0%, #c5cae9 45%, #e3f2fd 100%)',
    banner: 'rgba(220,228,250,0.75)',
    border: 'rgba(160,185,235,0.5)',
    nameColor: '#1a237e',
  },
};

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
      let breadthLabel;
      if (categories.length >= 8 && avgLinksPerCat < 4)      breadthLabel = 'Wide Explorer';
      else if (categories.length <= 4 && avgLinksPerCat >= 5) breadthLabel = 'Deep Diver';
      else if (avgLinksPerCat >= 5)                           breadthLabel = 'Focused & Deep';
      else                                                    breadthLabel = 'Balanced Curator';

      const executionPct   = links.length > 0 ? Math.round((thisMonthLinks.length / links.length) * 100) : 0;
      const executionValue = links.length > 0 ? `${executionPct}% this month` : 'Just getting started';

      const lastMonthEntries = Object.entries(lastMonthByCat).sort((a, b) => b[1] - a[1]);
      const lastMonthTopCat  = lastMonthEntries[0]?.[0] ?? null;
      let driftValue;
      if (!lastMonthTopCat)                driftValue = 'Finding your path';
      else if (lastMonthTopCat === eraName) driftValue = 'Staying the course';
      else                                  driftValue = `${lastMonthTopCat} → ${eraName}`;

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

      const newComputed = { themeValue: eraName, breadthValue: breadthLabel, executionValue, driftValue };
      setComputed(newComputed);

      const stats = {
        dominantTheme: eraName, dominantThemeCount: eraLinkCount,
        breadthLabel, totalCategories: categories.length, avgLinksPerCat: avgLinksPerCat.toFixed(1),
        executionPct, thisMonthLinks: thisMonthLinks.length, allTimeLinks: links.length,
        lastMonthTopCat, topCategories, monthOverMonth, topNewCategory, topNewCategoryCount,
      };

      const res  = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      const data = await res.json();
      setReport(data.report);
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
                  {/* Season banner */}
                  <div
                    className="season-banner"
                    style={{ background: season.banner, border: `1px solid ${season.border}` }}
                  >
                    <span className="season-emoji">{season.emoji}</span>
                    <span className="season-name" style={{ color: season.nameColor }}>{season.label}</span>
                    <p className="season-reason">{report.seasonReason}</p>
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
