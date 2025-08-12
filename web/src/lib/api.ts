import type { Island, MetricPoint, TimeWindow } from './types';

export async function fetchIslands(params: { window: TimeWindow; query?: string; category?: string; limit?: number; sort?: string }): Promise<Island[]> {
  const url = new URL('/api/islands', location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export type Research = {
  summary: string;
  highlights?: string[];
  sources?: { title?: string; url: string }[];
  updatedAt: string;
};

export async function fetchIslandResearch(code: string, name?: string, lang?: string): Promise<Research> {
  const url = new URL(`/api/islands/${code}/research`, location.origin);
  if (name) url.searchParams.set('name', name);
  if (lang) url.searchParams.set('lang', lang);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function fetchIslandMetrics(code: string, window: TimeWindow): Promise<{ metric: string; points: MetricPoint[] }[]> {
  const url = new URL(`/api/islands/${code}/metrics`, location.origin);
  url.searchParams.set('window', window);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}


