/**
 * xApi.js
 * ─────────────────────────────────────────────────────────────
 * Frontend API utilities for X (Twitter) integration.
 * Optimized for PostToXModal + general usage.
 * ─────────────────────────────────────────────────────────────
 */

import { auth } from '../config/firebase';
import toast from 'react-hot-toast';

const BASE = import.meta.env.VITE_API_URL ?? '';

/** Get auth headers with Firebase token */
const authHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const message = data.error || data.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
};

export const xApi = {
  /** Start OAuth flow */
  connect: async () => {
    const res = await fetch(`${BASE}/x/connect-url`, {
      headers: await authHeaders(),
    });

    const data = await handleResponse(res);

    if (!data?.url) {
      throw new Error('Failed to start X OAuth');
    }

    window.location.href = data.url;
  },

  /** Get current X connection status */
  getStatus: async () => {
    const res = await fetch(`${BASE}/x/status`, {
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },

  /**
   * Post to X — Main method used by PostToXModal
   */
  post: async ({ text, sourceId, sourceType = 'quote' }) => {
    if (!text?.trim()) throw new Error('Text is required');

    const res = await fetch(`${BASE}/x/post`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        text: text.trim(),
        sourceId,
        sourceType,
      }),
    });

    return handleResponse(res);
  },

  /**
   * Convenient method with toast feedback (Recommended for modals)
   */
  postWithFeedback: async (payload) => {
    try {
      const result = await xApi.post(payload);

      toast.success('Posted to X successfully 🚀');

      if (result?.tweetUrl) {
        setTimeout(() => {
          window.open(result.tweetUrl, '_blank', 'noopener,noreferrer');
        }, 600);
      }

      return result;
    } catch (err) {
      throw new Error(
        err.message?.includes('not connected')
          ? 'Please connect your X account first'
          : (err.message || 'Failed to post to X')
      );
    }
  },
   /**
   * Post to X with an image blob attached.
   * Used by the share preview window via window.opener.xApi.postWithMedia()
   */
  postWithMedia: async ({ imageBlob, text, sourceId, sourceType = 'quote' }) => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error('Not authenticated — please log in');

    const form = new FormData();
    form.append('image',      imageBlob, 'damuchi-share.png');
    form.append('text',       text);
    form.append('sourceId',   sourceId   ?? '');
    form.append('sourceType', sourceType ?? 'quote');

    const res = await fetch(`${BASE}/x/post-with-media`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` }, // no Content-Type — FormData sets it
      body:    form,
    });

    return handleResponse(res);
  },

  /** Disconnect X account */
  disconnect: async () => {
    const res = await fetch(`${BASE}/x/disconnect`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },

  /** Get post history */
  getHistory: async (limit = 20) => {
    const res = await fetch(`${BASE}/x/history?limit=${limit}`, {
      headers: await authHeaders(),
    });
    return handleResponse(res);
  },
};