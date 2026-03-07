import { describe, expect, it } from 'vitest';
import { buildDashboardResponse } from './dashboard.js';
import { applyHypeScores, buildIslandSummary } from './summary.js';
import type { IslandBasic, MetricSeries } from './types.js';

function buildSummary(basic: IslandBasic, series: MetricSeries[]) {
  return buildIslandSummary(basic, series);
}

describe('buildDashboardResponse', () => {
  it('keeps section arrays intact on partial data and marks degraded', () => {
    const summaries = applyHypeScores([
      buildSummary(
        {
          code: '1111-1111-1111',
          name: 'Alpha',
          creator: 'Studio A',
          tags: ['Action']
        },
        [
          {
            metric: 'uniquePlayers',
            points: [
              { ts: '2025-08-11T10:00:00Z', value: 100 },
              { ts: '2025-08-11T10:10:00Z', value: 140 }
            ]
          }
        ]
      ),
      buildSummary(
        {
          code: '2222-2222-2222',
          name: 'Bravo',
          creator: 'Studio B',
          tags: ['Action', 'Co-op']
        },
        [
          {
            metric: 'uniquePlayers',
            points: [
              { ts: '2025-08-11T10:00:00Z', value: 80 },
              { ts: '2025-08-11T10:10:00Z', value: 100 }
            ]
          },
          {
            metric: 'retentionD1',
            points: [
              { ts: '2025-08-11T10:00:00Z', value: 0.25 },
              { ts: '2025-08-11T10:10:00Z', value: 0.33 }
            ]
          },
          {
            metric: 'recommends',
            points: [
              { ts: '2025-08-11T10:00:00Z', value: 10 },
              { ts: '2025-08-11T10:10:00Z', value: 18 }
            ]
          },
          {
            metric: 'favorites',
            points: [
              { ts: '2025-08-11T10:00:00Z', value: 20 },
              { ts: '2025-08-11T10:10:00Z', value: 24 }
            ]
          }
        ]
      )
    ]);

    const response = buildDashboardResponse({
      summaries,
      window: '10m',
      sort: 'hype'
    });

    expect(response.degraded).toBe(true);
    expect(response.ranking).toHaveLength(2);
    expect(response.rising).toHaveLength(2);
    expect(response.highRetention).toHaveLength(2);
    expect(response.highRecommend).toHaveLength(2);
    expect(response.facets.tags).toContain('Action');
  });
});
