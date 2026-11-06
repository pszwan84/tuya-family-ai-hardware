'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../lib/session';

export default function HomePage() {
  const router = useRouter();
  const { session, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    router.replace(session ? '/me/drafts' : '/login');
  }, [ready, session, router]);

  return <div className="state">正在进入家事…</div>;
}