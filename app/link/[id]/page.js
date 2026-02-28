'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../../lib/firebase';
import PixelPlant from '../../../components/PixelPlant';

const auth = getAuth(app);
const db   = getFirestore(app);

export default function LinkDetail() {
  const { id }              = useParams();
  const [link, setLink]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); setNotFound(true); return; }
      try {
        const snap = await getDoc(doc(db, 'links', id));
        if (!snap.exists() || snap.data().uid !== user.uid) {
          setNotFound(true);
        } else {
          setLink({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [id]);

  if (loading) return null;

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

          {notFound ? (
            <div className="detail-box">
              <p style={{ color: '#5a8a5a' }}>Link not found.</p>
            </div>
          ) : (
            <div className="detail-box">
              <PixelPlant variant={link.variant ?? 0} size={2} />

              <h1 className="detail-title">Your Links</h1>

              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-open-btn"
              >
                {link.url}
              </a>
            </div>
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
