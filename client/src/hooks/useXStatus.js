/**
 * useXStatus.js
 * ─────────────────────────────────────────────────────────────
 * React Query hook that tracks whether the current user has
 * connected their X account and exposes connect / disconnect.
 *
 * Usage:
 *   const { connected, xUsername, xProfileImage, connect, disconnect, isLoading } = useXStatus();
 * ─────────────────────────────────────────────────────────────
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { xApi } from '../utils/xApi';
import toast    from 'react-hot-toast';

export const useXStatus = () => {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['xStatus'],
    queryFn:  xApi.getStatus,
    staleTime: 5 * 60 * 1000, // 5 min — doesn't change often
    retry:    false,
  });

  const disconnectMutation = useMutation({
    mutationFn: xApi.disconnect,
    onSuccess: () => {
      qc.setQueryData(['xStatus'], { connected: false });
      toast.success('X account disconnected');
    },
    onError: (err) => toast.error(err.message || 'Failed to disconnect'),
  });

  return {
    connected:      data?.connected ?? false,
    xUsername:      data?.xUsername ?? null,
    xProfileImage:  data?.xProfileImage ?? null,
    connectedAt:    data?.connectedAt ?? null,
    isLoading,
    connect:        xApi.connect,          // triggers redirect
    disconnect:     () => disconnectMutation.mutate(),
    isDisconnecting: disconnectMutation.isPending,
  };
};