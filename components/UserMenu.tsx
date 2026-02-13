'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session?.user) {
    return (
      <Link href="/login" className="btn btn-secondary user-signin-btn">
        Sign In
      </Link>
    );
  }

  const initials = (session.user.name || session.user.email || '?')
    .split(' ')
    .map(s => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-avatar-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
      >
        {session.user.image ? (
          <img src={session.user.image} alt="" className="user-avatar-img" />
        ) : (
          <span className="user-avatar-initials">{initials}</span>
        )}
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <span className="user-dropdown-name">{session.user.name || 'User'}</span>
            <span className="user-dropdown-email">{session.user.email}</span>
          </div>
          <div className="user-dropdown-divider" />
          <button
            className="user-dropdown-item"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
