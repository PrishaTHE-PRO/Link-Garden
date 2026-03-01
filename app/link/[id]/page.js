'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../../lib/firebase';
import PixelPlant from '../../../components/PixelPlant';

const auth = getAuth(app);
const db   = getFirestore(app);

export default function LinkDetail() {
  const { id }                  = useParams();
  const [link, setLink]         = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setNotFound(true); return; }

    getDoc(doc(db, 'links', id)).then(snap => {
      if (!snap.exists() || snap.data().uid !== user.uid) {
        setNotFound(true);
      } else {
        setLink({ id: snap.id, ...snap.data() });
      }
    }).catch(() => setNotFound(true));
  }, [id]);

  // Show shell immediately while data loads
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
          ) : !link ? (
            <div className="detail-box">
              <p style={{ color: '#7aaa7a' }}>Loading…</p>
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
