import { describe, expect, it } from 'vitest';
import { buildHypeNormalizationContext, computeHypeScore } from './hypeScore.js';

describe('computeHypeScore', () => {
  it('rebalances missing weights across available metrics', () => {
    const context = buildHypeNormalizationContext([
      {
        metrics: {
          uniquePlayers: 100,
          peakCcu: 50,
          retentionD1: 0.3,
          recommends: 1000
        },
        deltas: {
          uniquePlayers: {
            absolute: 10,
            percent: 0.25,
            previous: 40,
            direction: 'up'
          }
        }
      }
    ]);

    const result = computeHypeScore({
      metrics: {
        uniquePlayers: 100,
        peakCcu: null,
        retentionD1: 0.3,
        recommends: 1000
      },
      deltas: {
        uniquePlayers: {
          absolute: 10,
          percent: 0.25,
          previous: 40,
          direction: 'up'
        }
      }
    }, context);

    const peak = result.breakdown.find((item) => item.metric === 'peakCcu');
    const unique = result.breakdown.find((item) => item.metric === 'uniquePlayers');

    expect(peak?.missing).toBe(true);
    expect(unique?.effectiveWeight).toBeGreaterThan(0.28);
    expect(result.score).toBeGreaterThan(90);
  });

  it('gives zero trend contribution when latest change is negative', () => {
    const context = buildHypeNormalizationContext([
      {
        metrics: {
          uniquePlayers: 100,
          peakCcu: 100,
          minutesPerPlayer: 10,
          retentionD1: 0.2,
          recommends: 20,
          favorites: 20
        },
        deltas: {
          uniquePlayers: {
            absolute: 10,
            percent: 0.2,
            previous: 50,
            direction: 'up'
          }
        }
      }
    ]);

    const result = computeHypeScore({
      metrics: {
        uniquePlayers: 100,
        peakCcu: 100,
        minutesPerPlayer: 10,
        retentionD1: 0.2,
        recommends: 20,
        favorites: 20
      },
      deltas: {
        uniquePlayers: {
          absolute: -10,
          percent: -0.2,
          previous: 50,
          direction: 'down'
        }
      }
    }, context);

    const trend = result.breakdown.find((item) => item.metric === 'latestChange');
    expect(trend?.normalized).toBe(0);
  });
});
