'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { app } from '../lib/firebase';
import PixelPlant from '../components/PixelPlant';

const auth = getAuth(app);
const db   = getFirestore(app);

export default function Home() {
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [links,          setLinks]          = useState([]);
  const [clusters,       setClusters]       = useState([]);
  const [linkInput,      setLinkInput]      = useState('');
  const [planting,       setPlanting]       = useState(false);
  const [authEmail,      setAuthEmail]      = useState('');
  const [authPassword,   setAuthPassword]   = useState('');
  const [authError,      setAuthError]      = useState('');
  const [isSignup,       setIsSignup]       = useState(false);
  const [showPrompt,     setShowPrompt]     = useState(false);
  const [insight,        setInsight]        = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        loadLinks(u.uid);
        loadClusters(u.uid);
      }
    });
    return unsub;
  }, []);

  async function loadLinks(uid) {
    const q        = query(collection(db, 'links'), where('uid', '==', uid), orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);
    setLinks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadClusters(uid) {
    const q        = query(collection(db, 'clusters'), where('uid', '==', uid));
    const snapshot = await getDocs(q);
    setClusters(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function signUp() {
    setAuthError('');
    try { await createUserWithEmailAndPassword(auth, authEmail, authPassword); }
    catch (e) { setAuthError(friendlyError(e.code)); }
  }

  async function logIn() {
    setAuthError('');
    try { await signInWithEmailAndPassword(auth, authEmail, authPassword); }
    catch (e) { setAuthError(friendlyError(e.code)); }
  }

  async function logOut() {
    await signOut(auth);
    setLinks([]); setClusters([]); setInsight('');
  }

  async function plantLink() {
    if (!linkInput.trim()) return;
    if (!user) { setShowPrompt(true); return; }

    setPlanting(true);
    const raw = linkInput.trim();
    const url = raw.startsWith('http://') || raw.startsWith('https://')
      ? raw : 'https://' + raw;

    try {
      // Single API call: fetches metadata + Gemini naming, all server-side
      const res = await fetch('/api/plant-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, existingClusters: clusters.map(c => c.name) }),
      });
      const { title, description, plantName, clusterName } = await res.json();

      const variant = Math.abs(
        (clusterName || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      ) % 3;

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'links'), {
        uid: user.uid,
        url,
        title,
        plantName,
        description,
        clusterName,
        variant,
        savedAt: new Date(),
      });

      // Optimistic update — prepend immediately, no re-fetch needed
      const newLink = { id: docRef.id, uid: user.uid, url, title, plantName, description, clusterName, variant, savedAt: new Date() };
      setLinks(prev => [newLink, ...prev]);
      setLinkInput('');

      // Add cluster to local state if new
      if (!clusters.find(c => c.name === clusterName)) {
        const clusterRef = await addDoc(collection(db, 'clusters'), {
          uid: user.uid, name: clusterName, createdAt: new Date(),
        });
        setClusters(prev => [...prev, { id: clusterRef.id, uid: user.uid, name: clusterName }]);
      }
    } catch (err) {
      console.error('Error planting link:', err);
    } finally {
      setPlanting(false);
    }
  }

  async function generateInsight() {
    if (!user || links.length === 0) return;
    setInsightLoading(true);
    const clusterNames = [...new Set(links.map(l => l.clusterName).filter(Boolean))];
    const stats = {
      topClusters:          clusterNames.slice(0, 5),
      linkCountThisMonth:   links.length,
      newClustersThisMonth: clusters.length,
      breadthScore:         Math.min(clusterNames.length / 10, 1).toFixed(2),
      depthScore:           (links.length / Math.max(clusterNames.length, 1)).toFixed(1),
    };
    try {
      const res = await fetch('/api/generate-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      const { insight: text } = await res.json();
      setInsight(text);
    } catch (err) {
      console.error(err);
      setInsight('Your garden is growing beautifully. Keep exploring!');
    } finally {
      setInsightLoading(false);
    }
  }

  function friendlyError(code) {
    const map = {
      'auth/invalid-email':        'Please enter a valid email address.',
      'auth/user-not-found':       'No account found with that email.',
      'auth/wrong-password':       'Incorrect password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password':        'Password must be at least 6 characters.',
      'auth/invalid-credential':   'Incorrect email or password.',
      'auth/too-many-requests':    'Too many attempts. Please try again later.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  if (loading) return null;

  // ── Auth screen ──────────────────────────────────
  if (!user) {
    return (
      <>
        <Clouds />
        <div className="auth-screen">
          <div className="auth-card">
            <span style={{ fontSize: 40 }}>🌿</span>
            <h2>Welcome to Link Garden</h2>
            <p style={{ color: '#5a8a5a', fontSize: 14 }}>
              {isSignup ? 'Create your account to get started.' : 'Sign in to grow your collection.'}
            </p>
            <input type="email" placeholder="Email" value={authEmail}
              onChange={e => setAuthEmail(e.target.value)} autoComplete="email" />
            <input type="password" placeholder="Password" value={authPassword}
              onChange={e => setAuthPassword(e.target.value)} autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && (isSignup ? signUp() : logIn())} />
            <div className="auth-buttons">
              {isSignup
                ? <button className="btn-primary" onClick={signUp}>Create Account</button>
                : <><button className="btn-primary" onClick={logIn}>Log In</button>
                    <button className="btn-secondary" onClick={signUp}>Sign Up</button></>
              }
            </div>
            <p className="auth-error">{authError}</p>
            <p className="auth-toggle">
              {isSignup
                ? <>Already have an account? <span onClick={() => setIsSignup(false)}>Log in</span></>
                : <>No account? <span onClick={() => setIsSignup(true)}>Create one</span></>}
            </p>
          </div>
        </div>
        {showPrompt && (
          <div className="modal-overlay">
            <div className="modal-box">
              <p>🌱 Create an account to plant and save your links.</p>
              <div className="modal-actions">
                <button className="btn-primary" onClick={() => { setShowPrompt(false); setIsSignup(true); }}>
                  Create Account
                </button>
                <button className="btn-secondary" onClick={() => setShowPrompt(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Dashboard ────────────────────────────────────
  return (
    <>
      <Clouds />
      <div className="dashboard">
        <header>
          <span style={{ fontSize: 22 }}>🌿</span>
          <span className="logo">Link Garden</span>
          <span className="user-email">{user.email}</span>
          <button className="btn-logout" onClick={logOut}>Log out</button>
        </header>

        <div className="hero">
          <h1>Your Link Garden</h1>
          <p>Paste a link and plant it to grow your collection.</p>
        </div>

        <div className="input-area">
          <input
            type="text"
            placeholder="Paste a link here..."
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && plantLink()}
            autoFocus
          />
          <button onClick={plantLink} disabled={planting}>
            {planting ? '🌱 Planting…' : '🌱 Plant'}
          </button>
        </div>

        {links.length > 0 && (
          <div className="insight-box">
            <div className="insight-card">
              <h3>Garden Insight</h3>
              {insight
                ? <p>{insight}</p>
                : <p style={{ color: '#7aaa7a', fontStyle: 'italic' }}>
                    Generate an insight about your curiosity patterns.
                  </p>
              }
              <button className="insight-btn" onClick={generateInsight} disabled={insightLoading}>
                {insightLoading ? 'Thinking…' : '✨ Generate insight'}
              </button>
            </div>
          </div>
        )}

        <div className="garden-grid-wrapper">
          {links.length === 0
            ? <span className="empty-hint">Your planted links will appear here.</span>
            : (
              <div className="garden-grid">
                {links.map(link => (
                  <Link key={link.id} href={`/link/${link.id}`} className="plant-card">
                    <PixelPlant variant={link.variant ?? 0} size={1.4} />
                    <p className="plant-title">{link.plantName || link.title || '🌱'}</p>
                    {link.clusterName && (
                      <span className="plant-cluster">{link.clusterName}</span>
                    )}
                  </Link>
                ))}
              </div>
            )
          }
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
