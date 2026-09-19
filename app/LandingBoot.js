'use client';

import { useEffect } from 'react';
import initLanding from '@/lib/client/landing';

export default function LandingBoot() {
  useEffect(() => { initLanding(); }, []);
  return null;
}
