import type { CardDef } from './types';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8787';

export type User = {
  id: number;
  username: string;
  displayName: string;
};

export type Deck = {
  id: number;
  name: string;
  cardIds: string[];
  isActive: boolean;
  updatedAt: string;
};

export type Progress = {
  wins: number;
  losses: number;
  xp: number;
  matchesPlayed: number;
  updatedAt: string;
};

const TOKEN_KEY = 'aetherion_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${SERVER_URL}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'فشل الطلب');
  return data as T;
}

export const api = {
  register(username: string, password: string, displayName?: string) {
    return request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    });
  },
  login(username: string, password: string) {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return request<{ user: User }>('/api/auth/me');
  },
  cards() {
    return request<CardDef[]>('/api/cards');
  },
  progress() {
    return request<Progress>('/api/progress');
  },
  decks() {
    return request<{ decks: Deck[] }>('/api/decks');
  },
  saveDeck(payload: { name: string; cardIds: string[]; isActive?: boolean; id?: number }) {
    if (payload.id) {
      return request<{ deck: Deck }>(`/api/decks/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }
    return request<{ deck: Deck }>('/api/decks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  activateDeck(id: number) {
    return request<{ deck: Deck }>(`/api/decks/${id}/activate`, { method: 'POST' });
  },
};
