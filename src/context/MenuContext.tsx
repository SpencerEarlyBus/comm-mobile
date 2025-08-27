// src/context/MenuContext.tsx
import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback } from 'react';

type Ctx = {
  leftOpen: boolean;
  rightOpen: boolean;
  openLeft: () => void;
  closeLeft: () => void;
  openRight: () => void;
  closeRight: () => void;
};

const MenuContext = createContext<Ctx | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const openLeft = useCallback(() => setLeftOpen(true), []);
  const closeLeft = useCallback(() => setLeftOpen(false), []);
  const openRight = useCallback(() => setRightOpen(true), []);
  const closeRight = useCallback(() => setRightOpen(false), []);

  const value = useMemo(() => ({
    leftOpen, rightOpen, openLeft, closeLeft, openRight, closeRight
  }), [leftOpen, rightOpen, openLeft, closeLeft, openRight, closeRight]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('useMenu must be used within MenuProvider');
  return ctx;
}
