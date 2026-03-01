'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { app } from '../lib/firebase';
import PixelPlant from '../components/PixelPlant';
import NavMenu from '../components/NavMenu';

const auth = getAuth(app);
const db   = getFirestore(app);

function hashVariant(str) {
  return Math.abs((str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 5;
}

export default function Home() {
  const [user,              setUser]              = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [categories,        setCategories]        = useState([]);
  const [linkInput,         setLinkInput]         = useState('');
  const [pendingUrl,        setPendingUrl]        = useState('');
  const [showPicker,        setShowPicker]        = useState(false);
  const [newCatName,        setNewCatName]        = useState('');
  const [authEmail,         setAuthEmail]         = useState('');
  const [authPassword,      setAuthPassword]      = useState('');
  const [authError,         setAuthError]         = useState('');
  const [isSignup,          setIsSignup]          = useState(false);
  const [showPrompt,        setShowPrompt]        = useState(false);
  const [linkCount,         setLinkCount]         = useState(0);
  const [showNamePrompt,    setShowNamePrompt]    = useState(false);
  const [displayNameInput,  setDisplayNameInput]  = useState('');
  const [nameError,         setNameError]         = useState('');
  const newCatRef = useRef(null);

  useEffect(() => {
    let unsubCats  = null;
    let unsubLinks = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      if (unsubCats)  { unsubCats();  unsubCats  = null; }
      if (unsubLinks) { unsubLinks(); unsubLinks = null; }

      if (u) {
        setShowNamePrompt(!u.displayName);
        setDisplayNameInput(u.displayName || '');
        setNameError('');
        const qCats = query(collection(db, 'categories'), where('uid', '==', u.uid));
        unsubCats = onSnapshot(qCats, (snap) => {
          const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          cats.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
          setCategories(cats);
        });

        const qLinks = query(collection(db, 'links'), where('uid', '==', u.uid));
        unsubLinks = onSnapshot(qLinks, (snap) => setLinkCount(snap.size));
      } else {
        setShowNamePrompt(false);
        setDisplayNameInput('');
        setNameError('');
        setCategories([]);
        setLinkCount(0);
      }
    });

    return () => { unsubAuth(); if (unsubCats) unsubCats(); if (unsubLinks) unsubLinks(); };
  }, []);

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
    setCategories([]);
  }

  async function saveDisplayName() {
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      setNameError('Please enter your name.');
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
      setUser((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
      setShowNamePrompt(false);
      setNameError('');
    } catch {
      setNameError('Could not save your name. Please try again.');
    }
  }

  // Step 1: user hits Plant → show category picker
  function openPicker() {
    if (!linkInput.trim()) return;
    if (!user) { setShowPrompt(true); return; }
    const raw = linkInput.trim();
    const url = raw.startsWith('http://') || raw.startsWith('https://')
      ? raw : 'https://' + raw;
    setPendingUrl(url);
    setLinkInput('');
    setShowPicker(true);
    setTimeout(() => newCatRef.current?.focus(), 50);
  }

  // Step 2: user picks or creates a category
  function confirmCategory(name) {
    const categoryName = name.trim();
    if (!categoryName) return;

    const existing = categories.find(c => c.name === categoryName);
    const variant  = hashVariant(categoryName);

    setShowPicker(false);
    setPendingUrl('');
    setNewCatName('');

    // Save link (fire and forget)
    addDoc(collection(db, 'links'), {
      uid: user.uid, url: pendingUrl, categoryName, savedAt: new Date(),
    });

    // Save new category — onSnapshot will update the UI automatically
    if (!existing) {
      addDoc(collection(db, 'categories'), {
        uid: user.uid, name: categoryName, variant, createdAt: new Date(),
      }).catch(err => console.error('Failed to save category:', err));
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
  const userLabel = user?.displayName?.trim() || user?.email || 'Gardener';

  // ── Auth screen ──────────────────────────────────
  if (!user) {
    return (
      <>
        <Clouds />
        <div className="auth-screen">
          <div className="auth-card">
            <span style={{ fontSize: 50 }}>🌿</span>
            <h2>Welcome to Link Garden</h2>
            <p style={{ color: '#5a8a5a', fontSize: 20 }}>
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
          <span className="user-email">{userLabel}</span>
          <button className="btn-logout" onClick={logOut}>Log out</button>
          <NavMenu />
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
            onKeyDown={e => e.key === 'Enter' && openPicker()}
            autoFocus
          />
          <button onClick={openPicker}>🌱 Plant</button>
        </div>

        {categories.length > 0 && (
          <div className="insight-box">
            <div className="insight-card">
              <h3>Garden Insight</h3>
              <p>You've saved {linkCount} {linkCount === 1 ? 'link' : 'links'} across {categories.length} {categories.length === 1 ? 'topic' : 'topics'}. Your garden is growing — keep exploring!</p>
            </div>
          </div>
        )}

        <div className="garden-grid-wrapper">
          {categories.length === 0
            ? <span className="empty-hint">Your planted links will appear here.</span>
            : (
              <div className="garden-grid">
                {categories.map(cat => (
                  <Link key={cat.id} href={`/category/${encodeURIComponent(cat.name)}`} className="plant-card">
                    <div className="plant-image-crop">
                      <PixelPlant variant={cat.variant ?? 0} size={2.35} />
                    </div>
                    <span className="plant-cluster">{cat.name}</span>
                  </Link>
                ))}
              </div>
            )
          }
        </div>

      </div>

      {/* ── Category picker modal ── */}
      {showPicker && (
        <div className="modal-overlay">
          <div className="modal-box category-picker">
            <h3>Where does this link belong?</h3>

            {categories.length > 0 && (
              <>
                <div className="picker-section-label">Add to an existing category</div>
                <div className="picker-chips">
                  {categories.map(cat => (
                    <button key={cat.id} className="picker-chip" onClick={() => confirmCategory(cat.name)}>
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="picker-divider"><span>or create a new one</span></div>
              </>
            )}

            {categories.length === 0 && (
              <p className="picker-section-label" style={{ textAlign: 'center' }}>
                Name your first category to get started
              </p>
            )}


            <div className="picker-new">
              <input
                ref={newCatRef}
                type="text"
                placeholder="Category name…"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmCategory(newCatName)}
                autoFocus={categories.length === 0}
              />
              <button
                className="btn-primary picker-add"
                onClick={() => confirmCategory(newCatName)}
                disabled={!newCatName.trim()}
              >
                Create
              </button>
            </div>

            <button className="btn-secondary" style={{ width: '100%' }}
              onClick={() => { setShowPicker(false); setPendingUrl(''); setNewCatName(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showNamePrompt && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p style={{ marginBottom: 12 }}>What should we call you?</p>
            <input
              type="text"
              placeholder="Your name"
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveDisplayName()}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1.5px solid #b0d4b0',
                marginBottom: 10,
                fontSize: 14,
              }}
            />
            <p className="auth-error" style={{ marginBottom: 8 }}>{nameError}</p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={saveDisplayName}>
              Save name
            </button>
          </div>
        </div>
      )}
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



