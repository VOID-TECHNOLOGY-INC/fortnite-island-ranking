import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  parseCompareQueryState,
  parseHomeQueryState,
  serializeCompareQueryState,
  serializeHomeQueryState,
  toCompareRequest,
  toDashboardRequest,
  useCompareQueryState,
  useHomeQueryState
} from './urlState';

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </MemoryRouter>
    );
  };
}

describe('urlState', () => {
  it('parses home query state with defaults and normalized lists', () => {
    const state = parseHomeQueryState('?window=1h&tab=rising&sort=peakCcu&query=%20zone%20&tags=pvp,co-op&tags=co-op&creator=Epic&view=cards');

    expect(state).toEqual({
      window: '1h',
      tab: 'rising',
      sort: 'peakCcu',
      query: 'zone',
      tags: ['pvp', 'co-op'],
      creator: 'Epic',
      view: 'cards'
    });
  });

  it('serializes home query state without default values', () => {
    const searchParams = serializeHomeQueryState({
      window: '10m',
      tab: 'top',
      sort: 'hype',
      query: 'battle',
      tags: ['action', 'action', 'team'],
      creator: '',
      view: 'cards'
    });

    expect(searchParams.toString()).toBe('query=battle&tags=action%2Cteam&view=cards');
  });

  it('parses compare codes and caps them at 4', () => {
    const state = parseCompareQueryState('?window=24h&codes=1111,2222,2222&codes=3333,4444,5555');

    expect(state).toEqual({
      window: '24h',
      codes: ['1111', '2222', '3333', '4444']
    });
  });

  it('builds dashboard and compare API requests from state', () => {
    expect(
      toDashboardRequest({
        window: '24h',
        tab: 'top',
        sort: 'favorites',
        query: '',
        tags: ['co-op'],
        creator: 'Epic',
        view: 'table'
      })
    ).toEqual({
      window: '24h',
      sort: 'favorites',
      tags: ['co-op'],
      creator: 'Epic'
    });

    expect(
      toCompareRequest({
        window: '1h',
        codes: ['1111', '2222']
      })
    ).toEqual({
      window: '1h',
      codes: ['1111', '2222']
    });
  });

  it('updates home query params through the hook API', () => {
    const { result } = renderHook(() => useHomeQueryState(), {
      wrapper: createWrapper('/?window=1h')
    });

    act(() => {
      result.current[1]({
        query: 'zone wars',
        tags: ['pvp', 'ranked'],
        view: 'cards'
      });
    });

    expect(result.current[0]).toEqual({
      window: '1h',
      tab: 'top',
      sort: 'hype',
      query: 'zone wars',
      tags: ['pvp', 'ranked'],
      creator: '',
      view: 'cards'
    });
  });

  it('updates compare codes through the hook API', () => {
    const { result } = renderHook(() => useCompareQueryState(), {
      wrapper: createWrapper('/compare?codes=1111')
    });

    act(() => {
      result.current[1]((current: (typeof result.current)[0]) => ({
        codes: [...current.codes, '2222', '3333', '4444', '5555']
      }));
    });

    expect(serializeCompareQueryState(result.current[0]).toString()).toBe('codes=1111%2C2222%2C3333%2C4444');
  });
});
