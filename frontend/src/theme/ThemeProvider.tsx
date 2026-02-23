'use client';

import React, { useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { useTranslation } from 'react-i18next';
import { createAppTheme } from './theme';

// LTR cache
const ltrCache = createCache({ key: 'mui-ltr' });

// RTL cache
const rtlCache = createCache({
  key: 'mui-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const direction = isRtl ? 'rtl' : 'ltr';

  const theme = useMemo(() => createAppTheme(direction), [direction]);
  const cache = isRtl ? rtlCache : ltrCache;

  // Set document direction
  React.useEffect(() => {
    document.dir = direction;
    document.documentElement.lang = i18n.language;
  }, [direction, i18n.language]);

  return (
    <CacheProvider value={cache}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </CacheProvider>
  );
}
