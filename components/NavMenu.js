'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function NavMenu({ style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="nav-menu-wrapper" ref={ref} style={style}>
      <button
        className="hamburger-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <span /><span /><span />
      </button>

      <div
        className={`nav-sidebar-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside className={`nav-sidebar${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="nav-sidebar-header">Menu</div>
        <Link href="/report" className="nav-sidebar-item" onClick={() => setOpen(false)}>
          Personality Report
        </Link>
      </aside>
    </div>
  );
}
