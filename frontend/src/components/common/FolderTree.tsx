'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Stack,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore,
  ChevronRight,
  CreateNewFolder as NewFolderIcon,
} from '@mui/icons-material';
import { folderApi } from '@/api';
import type { Folder } from '@/types';

export interface FolderTreeProps {
  scopeType: 'case' | 'customer' | 'tenant';
  scopeId: string;
  selectedFolderId?: string;
  onSelectFolder?: (folder: Folder) => void;
  showCreateButton?: boolean;
}

interface TreeNodeProps {
  folder: Folder;
  depth: number;
  selectedId?: string;
  onSelect?: (folder: Folder) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

function TreeNode({ folder, depth, selectedId, onSelect, expandedIds, onToggle }: TreeNodeProps) {
  const isExpanded = expandedIds.has(folder.id);
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <>
      <ListItemButton
        selected={selectedId === folder.id}
        onClick={() => onSelect?.(folder)}
        sx={{ pl: 2 + depth * 2, py: 0.5, borderRadius: 1 }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folder.id);
            }}
            sx={{ mr: 0.5, p: 0.25 }}
          >
            {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 28, mr: 0.5 }} />
        )}
        <ListItemIcon sx={{ minWidth: 32 }}>
          {isExpanded ? (
            <FolderOpenIcon fontSize="small" color="primary" />
          ) : (
            <FolderIcon fontSize="small" color="action" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={folder.name}
          primaryTypographyProps={{
            fontSize: '0.8125rem',
            fontWeight: selectedId === folder.id ? 600 : 400,
          }}
          secondary={folder.document_count != null ? `${folder.document_count} files` : undefined}
          secondaryTypographyProps={{ fontSize: '0.7rem' }}
        />
      </ListItemButton>
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List disablePadding dense>
            {folder.children!.map((child) => (
              <TreeNode
                key={child.id}
                folder={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggle={onToggle}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

export default function FolderTree({
  scopeType,
  scopeId,
  selectedFolderId,
  onSelectFolder,
  showCreateButton = true,
}: FolderTreeProps) {
  const [tree, setTree] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const data = await folderApi.getTree(scopeType, scopeId);
      setTree(data);
      // Expand all by default
      const ids = new Set<string>();
      const walk = (folders: Folder[]) => {
        for (const f of folders) {
          ids.add(f.id);
          if (f.children) walk(f.children);
        }
      };
      walk(data);
      setExpandedIds(ids);
    } finally {
      setLoading(false);
    }
  }, [scopeType, scopeId]);

  useEffect(() => {
    if (scopeId) loadTree();
  }, [loadTree, scopeId]);

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      await folderApi.create({
        name: newFolderName.trim(),
        scopeType,
        scopeId,
        parentFolderId: selectedFolderId,
      });
      setNewFolderName('');
      setCreateOpen(false);
      loadTree();
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {showCreateButton && (
        <Stack direction="row" justifyContent="flex-end" mb={1}>
          <Button
            size="small"
            startIcon={<NewFolderIcon />}
            onClick={() => setCreateOpen(true)}
          >
            New Folder
          </Button>
        </Stack>
      )}

      {tree.length === 0 ? (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No folders yet.
        </Typography>
      ) : (
        <List dense disablePadding>
          {tree.map((folder) => (
            <TreeNode
              key={folder.id}
              folder={folder}
              depth={0}
              selectedId={selectedFolderId}
              onSelect={onSelectFolder}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />
          ))}
        </List>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            sx={{ mt: 1 }}
          />
          {selectedFolderId && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Will be created inside the selected folder.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFolder}
            disabled={creating || !newFolderName.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
