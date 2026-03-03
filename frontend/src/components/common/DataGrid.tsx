'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import EmptyState from './EmptyState';

export interface DataGridColumn<T> {
  field: string;
  headerName: string;
  width?: number | string;
  minWidth?: number;
  flex?: number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  renderCell?: (row: T, index: number) => React.ReactNode;
}

/** Alias kept for backwards compatibility */
export type Column<T> = DataGridColumn<T>;

export interface DataGridProps<T> {
  columns: DataGridColumn<T>[];
  rows: T[];
  loading?: boolean;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  // Search
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  // Pagination
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  // Sort
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  // Toolbar
  toolbarActions?: React.ReactNode;
  onRefresh?: () => void;
  // Misc
  stickyHeader?: boolean;
  maxHeight?: number | string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
}

export default function DataGrid<T extends Record<string, any>>({
  columns,
  rows,
  loading = false,
  getRowId,
  onRowClick,
  searchPlaceholder,
  onSearch,
  totalCount,
  page = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  sortField,
  sortDirection = 'asc',
  onSort,
  toolbarActions,
  onRefresh,
  stickyHeader = true,
  maxHeight,
  emptyMessage,
  emptyAction,
}: DataGridProps<T>) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState('');

  // Local filtering if no onSearch provided
  const filteredRows = useMemo(() => {
    if (onSearch || !localSearch.trim()) return rows;
    const q = localSearch.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some(
        (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q),
      ),
    );
  }, [rows, localSearch, onSearch]);

  // Local sorting if no onSort provided
  const sortedRows = useMemo(() => {
    if (onSort || !sortField) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortField, sortDirection, onSort]);

  const displayRows = sortedRows;

  const handleSort = (field: string) => {
    if (onSort) {
      const newDir = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(field, newDir);
    }
  };

  const rowId = (row: T, idx: number): string => {
    if (getRowId) return getRowId(row);
    return (row as Record<string, unknown>).id as string ?? String(idx);
  };

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* Toolbar */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5 }}
      >
        <TextField
          size="small"
          placeholder={searchPlaceholder || t('common.search')}
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value);
            onSearch?.(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 280 }}
        />
        <Box sx={{ flex: 1 }} />
        {toolbarActions}
        {onRefresh && (
          <Tooltip title={t('common.refresh')}>
            <IconButton size="small" onClick={onRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Table */}
      <TableContainer sx={{ maxHeight: maxHeight || 'calc(100vh - 320px)' }}>
        <Table stickyHeader={stickyHeader} size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.field}
                  align={col.align || 'left'}
                  sx={{
                    width: col.width,
                    minWidth: col.minWidth,
                    fontWeight: 600,
                  }}
                  sortDirection={sortField === col.field ? sortDirection : false}
                >
                  {col.sortable !== false && onSort ? (
                    <TableSortLabel
                      active={sortField === col.field}
                      direction={sortField === col.field ? sortDirection : 'asc'}
                      onClick={() => handleSort(col.field)}
                    >
                      {col.headerName}
                    </TableSortLabel>
                  ) : (
                    col.headerName
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState message={emptyMessage} action={emptyAction} />
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, idx) => (
                <TableRow
                  key={rowId(row, idx)}
                  hover
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.field} align={col.align || 'left'}>
                      {col.renderCell
                        ? col.renderCell(row, idx)
                        : (row[col.field] as React.ReactNode) ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {(onPageChange || totalCount !== undefined) && (
        <TablePagination
          component="div"
          count={totalCount ?? displayRows.length}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, p) => onPageChange?.(p)}
          onRowsPerPageChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          rowsPerPageOptions={pageSizeOptions}
        />
      )}
    </Paper>
  );
}
