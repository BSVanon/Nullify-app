// ThemeContext.jsx - manages dark/light theme via Tailwind 'dark' class
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
  textScale: 'md',
  setTextScale: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [textScale, setTextScale] = useState('md');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('nullify.theme');
      let initialTheme = 'dark';
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        initialTheme = stored;
      } else if (typeof window !== 'undefined' && window.matchMedia) {
        initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      setTheme(initialTheme);
    } catch (err) {
      console.warn('Failed to read stored theme preference', err);
    }
  }, []);

  useEffect(() => {
    try {
      const storedScale = localStorage.getItem('nullify.textScale');
      if (storedScale === 'sm' || storedScale === 'md' || storedScale === 'lg') {
        setTextScale(storedScale);
      }
    } catch (err) {
      console.warn('Failed to read stored text scale preference', err);
    }
  }, []);

  useEffect(() => {
    try {
      const root = document.documentElement;
      let effectiveTheme = theme;
      if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (effectiveTheme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      localStorage.setItem('nullify.theme', theme);
    } catch (err) {
      console.warn('Failed to persist theme preference', err);
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('nullify.textScale', textScale);
    } catch (err) {
      console.warn('Failed to persist text scale preference', err);
    }
  }, [textScale]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      textScale,
      setTextScale,
    }),
    [theme, textScale],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
