import { useSearchParams } from 'react-router-dom';
import type {
  CompareQueryState,
  CompareRequest,
  DashboardRequest,
  DashboardSort,
  DashboardTab,
  DashboardView,
  DetailQueryState,
  HomeQueryState,
  TimeWindow
} from './types';

const WINDOWS: TimeWindow[] = ['10m', '1h', '24h'];
const TABS: DashboardTab[] = ['top', 'rising'];
const SORTS: DashboardSort[] = [
  'hype',
  'uniquePlayers',
  'peakCcu',
  'minutesPerPlayer',
  'retentionD1',
  'recommends',
  'favorites',
  'latestChange'
];
const VIEWS: DashboardView[] = ['table', 'cards'];

export const DEFAULT_HOME_QUERY_STATE: HomeQueryState = {
  window: '10m',
  tab: 'top',
  sort: 'hype',
  query: '',
  tags: [],
  creator: '',
  view: 'table'
};

export const DEFAULT_DETAIL_QUERY_STATE: DetailQueryState = {
  window: '10m'
};

export const DEFAULT_COMPARE_QUERY_STATE: CompareQueryState = {
  window: '10m',
  codes: []
};

type SearchPatch<T> = Partial<T> | ((current: T) => Partial<T>);

function normalizeList(values: string[], maxItems?: number): string[] {
  const deduped = [...new Set(values.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean))];
  return maxItems ? deduped.slice(0, maxItems) : deduped;
}

function pickOne<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function parseWindow(searchParams: URLSearchParams): TimeWindow {
  return pickOne(searchParams.get('window'), WINDOWS, DEFAULT_HOME_QUERY_STATE.window);
}

export function parseHomeQueryState(input: URLSearchParams | string): HomeQueryState {
  const searchParams = typeof input === 'string' ? new URLSearchParams(input) : input;

  return {
    window: parseWindow(searchParams),
    tab: pickOne(searchParams.get('tab'), TABS, DEFAULT_HOME_QUERY_STATE.tab),
    sort: pickOne(searchParams.get('sort'), SORTS, DEFAULT_HOME_QUERY_STATE.sort),
    query: (searchParams.get('query') ?? '').trim(),
    tags: normalizeList(searchParams.getAll('tags').concat(searchParams.get('tags') ?? '')),
    creator: (searchParams.get('creator') ?? '').trim(),
    view: pickOne(searchParams.get('view'), VIEWS, DEFAULT_HOME_QUERY_STATE.view)
  };
}

export function parseDetailQueryState(input: URLSearchParams | string): DetailQueryState {
  const searchParams = typeof input === 'string' ? new URLSearchParams(input) : input;
  return {
    window: parseWindow(searchParams)
  };
}

export function parseCompareQueryState(input: URLSearchParams | string): CompareQueryState {
  const searchParams = typeof input === 'string' ? new URLSearchParams(input) : input;
  return {
    window: parseWindow(searchParams),
    codes: normalizeList(searchParams.getAll('codes').concat(searchParams.get('codes') ?? ''), 4)
  };
}

export function serializeHomeQueryState(state: Partial<HomeQueryState>): URLSearchParams {
  const nextState = { ...DEFAULT_HOME_QUERY_STATE, ...state };
  const searchParams = new URLSearchParams();

  if (nextState.window !== DEFAULT_HOME_QUERY_STATE.window) {
    searchParams.set('window', nextState.window);
  }
  if (nextState.tab !== DEFAULT_HOME_QUERY_STATE.tab) {
    searchParams.set('tab', nextState.tab);
  }
  if (nextState.sort !== DEFAULT_HOME_QUERY_STATE.sort) {
    searchParams.set('sort', nextState.sort);
  }
  if (nextState.query.trim()) {
    searchParams.set('query', nextState.query.trim());
  }
  if (nextState.tags.length > 0) {
    searchParams.set('tags', normalizeList(nextState.tags).join(','));
  }
  if (nextState.creator.trim()) {
    searchParams.set('creator', nextState.creator.trim());
  }
  if (nextState.view !== DEFAULT_HOME_QUERY_STATE.view) {
    searchParams.set('view', nextState.view);
  }

  return searchParams;
}

export function serializeDetailQueryState(state: Partial<DetailQueryState>): URLSearchParams {
  const nextState = { ...DEFAULT_DETAIL_QUERY_STATE, ...state };
  const searchParams = new URLSearchParams();
  if (nextState.window !== DEFAULT_DETAIL_QUERY_STATE.window) {
    searchParams.set('window', nextState.window);
  }
  return searchParams;
}

export function serializeCompareQueryState(state: Partial<CompareQueryState>): URLSearchParams {
  const nextState = { ...DEFAULT_COMPARE_QUERY_STATE, ...state };
  const searchParams = new URLSearchParams();

  if (nextState.window !== DEFAULT_COMPARE_QUERY_STATE.window) {
    searchParams.set('window', nextState.window);
  }
  if (nextState.codes.length > 0) {
    searchParams.set('codes', normalizeList(nextState.codes, 4).join(','));
  }

  return searchParams;
}

export function toDashboardRequest(state: HomeQueryState): DashboardRequest {
  return {
    window: state.window,
    sort: state.sort,
    tags: state.tags,
    creator: state.creator || undefined
  };
}

export function toCompareRequest(state: CompareQueryState): CompareRequest {
  return {
    window: state.window,
    codes: state.codes
  };
}

function useSearchState<T>(
  parser: (searchParams: URLSearchParams) => T,
  serializer: (state: Partial<T>) => URLSearchParams,
  defaults: T
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = parser(searchParams);

  const updateState = (patch: SearchPatch<T>, options?: { replace?: boolean }) => {
    const partial = typeof patch === 'function' ? patch(state) : patch;
    const nextState = { ...defaults, ...state, ...partial };
    setSearchParams(serializer(nextState), { replace: options?.replace ?? true });
  };

  return [state, updateState] as const;
}

export function useHomeQueryState() {
  return useSearchState(parseHomeQueryState, serializeHomeQueryState, DEFAULT_HOME_QUERY_STATE);
}

export function useDetailWindowState() {
  return useSearchState(parseDetailQueryState, serializeDetailQueryState, DEFAULT_DETAIL_QUERY_STATE);
}

export function useCompareQueryState() {
  return useSearchState(parseCompareQueryState, serializeCompareQueryState, DEFAULT_COMPARE_QUERY_STATE);
}
