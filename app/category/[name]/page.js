'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, where } from 'firebase/firestore';
import { app } from '../../../lib/firebase';

const auth = getAuth(app);
const db   = getFirestore(app);

export default function CategoryPage() {
  const params           = useParams();
  const categoryName     = decodeURIComponent(params.name);
  const [links, setLinks] = useState(null);

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
              <ul className="category-link-list">
                {links.map(link => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="category-link-item"
                    >
                      {link.url}
                    </a>
                  </li>
                ))}
              </ul>
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
