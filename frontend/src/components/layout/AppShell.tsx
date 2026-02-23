'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Divider,
  InputBase,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Gavel as GavelIcon,
  Description as DescriptionIcon,
  AccountBalance as AccountIcon,
  Assessment as ReportIcon,
  AdminPanelSettings as AdminIcon,
  Search as SearchIcon,
  Notifications as NotifIcon,
  Translate as LangIcon,
  AccountCircle,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Role } from '@/types';

const DRAWER_WIDTH = 240;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  path: string;
  roles?: Role[];
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout, hasAnyRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const navItems: NavItem[] = useMemo(
    () => [
      { key: 'dashboard', icon: <DashboardIcon />, path: '/' },
      { key: 'customers', icon: <PeopleIcon />, path: '/customers', roles: ['Lawyer', 'TenantAdmin'] },
      { key: 'cases', icon: <GavelIcon />, path: '/cases', roles: ['Lawyer', 'TenantAdmin'] },
      { key: 'documents', icon: <DescriptionIcon />, path: '/documents', roles: ['Lawyer', 'TenantAdmin'] },
      { key: 'accounting', icon: <AccountIcon />, path: '/accounting' },
      { key: 'reports', icon: <ReportIcon />, path: '/reports' },
      { key: 'admin', icon: <AdminIcon />, path: '/admin', roles: ['TenantAdmin', 'SystemAdmin'] },
    ],
    [],
  );

  const visibleNav = navItems.filter(item => {
    if (!item.roles) return true;
    return hasAnyRole(...item.roles);
  });

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" fontWeight={700} noWrap>
          LOMA
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {visibleNav.map(item => (
          <ListItemButton
            key={item.key}
            selected={item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)}
            onClick={() => {
              router.push(item.path);
              setMobileOpen(false);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={t(`nav.${item.key}`)} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <ProtectedRoute>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* App Bar */}
        <AppBar
          position="fixed"
          sx={{
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { md: `${DRAWER_WIDTH}px` },
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            {/* Global Search */}
            <Box
              sx={{
                position: 'relative',
                borderRadius: 1,
                bgcolor: theme => alpha(theme.palette.common.white, 0.15),
                '&:hover': { bgcolor: theme => alpha(theme.palette.common.white, 0.25) },
                mr: 2,
                width: { xs: 160, sm: 300 },
              }}
            >
              <Box sx={{ px: 1.5, height: '100%', position: 'absolute', display: 'flex', alignItems: 'center' }}>
                <SearchIcon />
              </Box>
              <InputBase
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                sx={{ color: 'inherit', pl: 5, pr: 1, py: 0.5, width: '100%' }}
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            {/* Notification Bell */}
            <Tooltip title={t('nav.notifications')}>
              <IconButton color="inherit" onClick={() => router.push('/notifications')}>
                <Badge badgeContent={0} color="error">
                  <NotifIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Language Toggle */}
            <Tooltip title={i18n.language === 'ar' ? 'English' : 'العربية'}>
              <IconButton color="inherit" onClick={toggleLang}>
                <LangIcon />
              </IconButton>
            </Tooltip>

            {/* User Menu */}
            <Tooltip title={user?.displayName || ''}>
              <IconButton color="inherit" onClick={e => setAnchorEl(e.currentTarget)}>
                <AccountCircle />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem disabled>
                <Typography variant="body2">
                  {user?.displayName} ({user?.roles.join(', ')})
                </Typography>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  logout();
                  router.push('/login');
                }}
              >
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                {t('auth.logout')}
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Side Drawer */}
        <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            mt: '64px',
          }}
        >
          {children}
        </Box>
      </Box>
    </ProtectedRoute>
  );
}
