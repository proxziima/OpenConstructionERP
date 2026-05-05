/** React Query hooks for the file manager. */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchFileList, fetchFileTree, fetchStorageLocations } from './api';
import type { FileFilters } from './types';

const KEY_TREE = 'file-manager-tree';
const KEY_LIST = 'file-manager-list';
const KEY_LOC = 'file-manager-locations';

export function useFileTree(projectId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY_TREE, projectId],
    queryFn: () => fetchFileTree(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useFileList(
  projectId: string | null | undefined,
  filters: FileFilters,
) {
  return useQuery({
    queryKey: [KEY_LIST, projectId, filters],
    queryFn: () => fetchFileList(projectId as string, filters),
    enabled: Boolean(projectId),
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useStorageLocations(projectId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY_LOC, projectId],
    queryFn: () => fetchStorageLocations(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
}

export const fileManagerKeys = {
  tree: KEY_TREE,
  list: KEY_LIST,
  locations: KEY_LOC,
};
