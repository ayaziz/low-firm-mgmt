'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Collapse,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Divider,
  InputBase,
  Avatar,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
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
  Logout as LogoutIcon,
  Event as CalendarIcon,
  Balance as CourtIcon,
  Article as TemplateIcon,
  Timer as TimeIcon,
  ExpandLess,
  ExpandMore,
  PersonAdd as NewCustomerIcon,
  NoteAdd as NewCaseIcon,
  UploadFile as NewDocIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Role } from '@/types';

const DRAWER_WIDTH = 260;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  path: string;
  roles?: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout, hasAnyRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: 'nav.groupMain',
        items: [
          { key: 'dashboard', icon: <DashboardIcon />, path: '/' },
          { key: 'calendar', icon: <CalendarIcon />, path: '/calendar', roles: ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'] },
        ],
      },
      {
        label: 'nav.groupLegal',
        items: [
          { key: 'customers', icon: <PeopleIcon />, path: '/customers', roles: ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'] },
          { key: 'cases', icon: <GavelIcon />, path: '/cases', roles: ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'] },
          { key: 'hearings', icon: <GavelIcon />, path: '/hearings', roles: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] },
          { key: 'courts', icon: <CourtIcon />, path: '/courts', roles: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] },
          { key: 'documents', icon: <DescriptionIcon />, path: '/documents', roles: ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'] },
          { key: 'templates', icon: <TemplateIcon />, path: '/templates', roles: ['Lawyer', 'TenantAdmin', 'SystemAdmin'] },
        ],
      },
      {
        label: 'nav.groupFinance',
        items: [
          { key: 'timeEntries', icon: <TimeIcon />, path: '/time-entries', roles: ['Lawyer', 'Accountant', 'TenantAdmin', 'SystemAdmin'] },
          { key: 'accounting', icon: <AccountIcon />, path: '/accounting' },
          { key: 'reports', icon: <ReportIcon />, path: '/reports' },
        ],
      },
      {
        label: 'nav.groupSystem',
        items: [
          { key: 'admin', icon: <AdminIcon />, path: '/admin', roles: ['TenantAdmin', 'SystemAdmin'] },
        ],
      },
    ],
    [],
  );

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

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

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  const quickActions = [
    { icon: <NewCustomerIcon />, name: t('nav.quickNewCustomer'), action: () => router.push('/customers?action=new') },
    { icon: <NewCaseIcon />, name: t('nav.quickNewCase'), action: () => router.push('/cases?action=new') },
    { icon: <NewDocIcon />, name: t('nav.quickNewDocument'), action: () => router.push('/documents?action=new') },
  ];

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand Header */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: 'primary.main',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.875rem',
          }}
        >
          LO
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            LOMA
          </Typography>
          <Typography variant="caption" color="text.secondary" lineHeight={1}>
            {t('app.title')}
          </Typography>
        </Box>
      </Box>
      <Divider />

      {/* Nav Groups */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {navGroups.map(group => {
          const visibleItems = group.items.filter(item =>
            !item.roles || hasAnyRole(...item.roles),
          );
          if (visibleItems.length === 0) return null;

          const isCollapsed = !!collapsedGroups[group.label];
          const groupHasActive = visibleItems.some(item => isActive(item.path));

          return (
            <React.Fragment key={group.label}>
              <ListItemButton
                onClick={() => toggleGroup(group.label)}
                sx={{
                  px: 2.5,
                  py: 0.5,
                  minHeight: 32,
                }}
              >
                <ListItemText
                  primary={t(group.label)}
                  primaryTypographyProps={{
                    variant: 'overline',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: groupHasActive ? 'primary.main' : 'text.secondary',
                    letterSpacing: 1,
                  }}
                />
                {isCollapsed ? <ExpandMore sx={{ fontSize: 16 }} /> : <ExpandLess sx={{ fontSize: 16 }} />}
              </ListItemButton>
              <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {visibleItems.map(item => {
                    const active = isActive(item.path);
                    return (
                      <ListItemButton
                        key={item.key}
                        onClick={() => {
                          router.push(item.path);
                          setMobileOpen(false);
                        }}
                        sx={{
                          pl: 3,
                          py: 0.75,
                          mx: 1,
                          borderRadius: 1.5,
                          mb: 0.25,
                          ...(active && {
                            bgcolor: 'primary.main',
                            color: '#fff',
                            '& .MuiListItemIcon-root': { color: '#fff' },
                            '&:hover': { bgcolor: 'primary.dark' },
                          }),
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: active ? '#fff' : 'text.secondary' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={t(`nav.${item.key}`)}
                          primaryTypographyProps={{
                            fontSize: '0.8125rem',
                            fontWeight: active ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </React.Fragment>
          );
        })}
      </Box>

      {/* User Footer */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: '0.75rem' }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user?.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.roles?.join(', ')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <ProtectedRoute>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.50' }}>
        {/* App Bar */}
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { md: `${DRAWER_WIDTH}px` },
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            <IconButton
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
                borderRadius: 2,
                bgcolor: 'grey.100',
                '&:hover': { bgcolor: 'grey.200' },
                mr: 2,
                width: { xs: 180, sm: 340 },
                transition: 'background-color 0.2s',
              }}
            >
              <Box sx={{ px: 1.5, height: '100%', position: 'absolute', display: 'flex', alignItems: 'center' }}>
                <SearchIcon color="action" />
              </Box>
              <InputBase
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                sx={{ pl: 5, pr: 1, py: 0.75, width: '100%', fontSize: '0.875rem' }}
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            {/* Notification Bell */}
            <Tooltip title={t('nav.notifications')}>
              <IconButton onClick={() => router.push('/notifications')}>
                <Badge badgeContent={0} color="error">
                  <NotifIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Language Toggle */}
            <Tooltip title={i18n.language === 'ar' ? 'English' : 'العربية'}>
              <IconButton onClick={toggleLang}>
                <LangIcon />
              </IconButton>
            </Tooltip>

            {/* User Menu */}
            <Tooltip title={user?.displayName || ''}>
              <IconButton onClick={e => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
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
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: 1,
                borderColor: 'divider',
              },
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
            position: 'relative',
          }}
        >
          {children}

          {/* Quick-Create Speed Dial */}
          <SpeedDial
            ariaLabel="Quick actions"
            sx={{ position: 'fixed', bottom: 24, right: 24 }}
            icon={<SpeedDialIcon />}
          >
            {quickActions.map(action => (
              <SpeedDialAction
                key={action.name}
                icon={action.icon}
                tooltipTitle={action.name}
                onClick={action.action}
              />
            ))}
          </SpeedDial>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}
