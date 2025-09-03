// src/context/UIChromeContext.tsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

type Ctx = { hidden: boolean; setHidden: (v: boolean) => void };
const UIChromeContext = createContext<Ctx | null>(null);

export function UIChromeProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const setHidden = useCallback((v: boolean) => setHiddenState(v), []);
  const value = useMemo(() => ({ hidden, setHidden }), [hidden, setHidden]);
  return <UIChromeContext.Provider value={value}>{children}</UIChromeContext.Provider>;
}

export function useUIChrome() {
  const ctx = useContext(UIChromeContext);
  if (!ctx) throw new Error('useUIChrome must be used within UIChromeProvider');
  return ctx;
}
