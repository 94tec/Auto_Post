import { auth } from '../config/firebase';
import toast    from 'react-hot-toast';

const BASE = import.meta.env.VITE_API_URL ?? '';

const authHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handle = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

export const queueApi = {
  add: async ({ quoteId, text, author, category }) => {
    const res = await fetch(`${BASE}/queue/add`, {
      method:  'POST',
      headers: await authHeaders(),
      body:    JSON.stringify({ quoteId, text, author, category }),
    });
    return handle(res);
  },

  list: async () => {
    // No status param — always fetch all, filter client-side
    const res = await fetch(`${BASE}/queue/list`, {
      headers: await authHeaders(),
    });
    return handle(res);
  },

  remove: async (id) => {
    const res = await fetch(`${BASE}/queue/${id}`, {
      method:  'DELETE',
      headers: await authHeaders(),
    });
    return handle(res);
  },

  retry: async (id) => {
    const res = await fetch(`${BASE}/queue/retry/${id}`, {
      method:  'POST',
      headers: await authHeaders(),
    });
    return handle(res);
  },

  analytics: async () => {
    const res = await fetch(`${BASE}/queue/analytics`, {
      headers: await authHeaders(),
    });
    return handle(res);
  },

  slots: async () => {
    const res = await fetch(`${BASE}/queue/slots`, {
      headers: await authHeaders(),
    });
    return handle(res);
  },
};