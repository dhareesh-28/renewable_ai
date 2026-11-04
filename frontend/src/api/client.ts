import { useQuery } from '@tanstack/react-query';
import type {
  HealthResponse,
  MetaResponse,
  SimulateResponse,
  CompareResponse,
  OutlookResponse,
  FaultsResponse,
  PeriodSummaryResponse,
  ModelPerformanceResponse,
} from './types';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function useHealthQuery() {
  return useQuery<HealthResponse, Error>({
    queryKey: ['health'],
    queryFn: () => fetchJson<HealthResponse>('/api/health'),
    staleTime: 60_000,
  });
}

export function useMetaQuery() {
  return useQuery<MetaResponse, Error>({
    queryKey: ['meta'],
    queryFn: () => fetchJson<MetaResponse>('/api/meta'),
    staleTime: 300_000,
  });
}

export interface SimulateParams {
  start?: string;
  end?: string;
  strategy?: string;
  battery_kwh?: number;
  battery_kw?: number;
}

export function useSimulateQuery(params: SimulateParams) {
  const searchParams = new URLSearchParams();
  if (params.start) searchParams.set('start', params.start);
  if (params.end) searchParams.set('end', params.end);
  if (params.strategy) searchParams.set('strategy', params.strategy);
  if (params.battery_kwh !== undefined) searchParams.set('battery_kwh', params.battery_kwh.toString());
  if (params.battery_kw !== undefined) searchParams.set('battery_kw', params.battery_kw.toString());

  const url = `/api/simulate?${searchParams.toString()}`;

  return useQuery<SimulateResponse, Error>({
    queryKey: ['simulate', params],
    queryFn: () => fetchJson<SimulateResponse>(url),
    enabled: Boolean(params.start && params.end),
    staleTime: 300_000,
  });
}

export interface CompareParams {
  start?: string;
  end?: string;
  battery_kwh?: number;
  battery_kw?: number;
}

export function useCompareQuery(params: CompareParams) {
  const searchParams = new URLSearchParams();
  if (params.start) searchParams.set('start', params.start);
  if (params.end) searchParams.set('end', params.end);
  if (params.battery_kwh !== undefined) searchParams.set('battery_kwh', params.battery_kwh.toString());
  if (params.battery_kw !== undefined) searchParams.set('battery_kw', params.battery_kw.toString());

  const url = `/api/compare?${searchParams.toString()}`;

  return useQuery<CompareResponse, Error>({
    queryKey: ['compare', params],
    queryFn: () => fetchJson<CompareResponse>(url),
    enabled: Boolean(params.start && params.end),
    staleTime: 300_000,
  });
}

export interface OutlookParams {
  start?: string;
  battery_kwh?: number;
  battery_kw?: number;
}

export function useOutlookQuery(params: OutlookParams) {
  const searchParams = new URLSearchParams();
  if (params.start) searchParams.set('start', params.start);
  if (params.battery_kwh !== undefined) searchParams.set('battery_kwh', params.battery_kwh.toString());
  if (params.battery_kw !== undefined) searchParams.set('battery_kw', params.battery_kw.toString());

  const url = `/api/outlook?${searchParams.toString()}`;

  return useQuery<OutlookResponse, Error>({
    queryKey: ['outlook', params],
    queryFn: () => fetchJson<OutlookResponse>(url),
    enabled: Boolean(params.start),
    staleTime: 300_000,
  });
}

export interface FaultsParams {
  start?: string;
  end?: string;
}

export function useFaultsQuery(params?: FaultsParams) {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);

  const qs = searchParams.toString();
  const url = qs ? `/api/faults?${qs}` : '/api/faults';

  return useQuery<FaultsResponse, Error>({
    queryKey: ['faults', params],
    queryFn: () => fetchJson<FaultsResponse>(url),
    staleTime: 300_000,
  });
}

export function usePeriodSummaryQuery(year: number = 2026, granularity: string = 'month') {
  return useQuery<PeriodSummaryResponse, Error>({
    queryKey: ['period-summary', year, granularity],
    queryFn: () => fetchJson<PeriodSummaryResponse>(`/api/period-summary?year=${year}&granularity=${granularity}`),
    staleTime: 300_000,
  });
}

export function useModelPerformanceQuery() {
  return useQuery<ModelPerformanceResponse, Error>({
    queryKey: ['model-performance'],
    queryFn: () => fetchJson<ModelPerformanceResponse>('/api/model-performance'),
    staleTime: 300_000,
  });
}

