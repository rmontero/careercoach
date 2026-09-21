'use client';

import { useState } from 'react';
import AgoraRTC, { AgoraRTCProvider } from 'agora-rtc-react';

/**
 * Provides the Agora RTC client to the room. Browser-only (the SDK touches `window`), so this
 * file is only ever loaded through a `ssr: false` dynamic import.
 */
export default function RtcProvider({ children }: { children: React.ReactNode }) {
  // State (not useMemo): it survives StrictMode's simulated remount, so exactly one client is used.
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
}
