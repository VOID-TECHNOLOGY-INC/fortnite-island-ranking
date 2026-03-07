import { describe, expect, it } from 'vitest';
import { computeHypeScore } from './hypeScore.js';

describe('computeHypeScore', () => {
  it('redistributes weights across available metrics', () => {
    const result = computeHypeScore(
      {
        uniquePlayers: 100,
        peakCcu: 50,
        minutesPerPlayer: null,
        retentionD1: null,
        recommends: null,
        favorites: null
      },
      {
        uniquePlayers: { min: 0, max: 100 },
        peakCcu: { min: 0, max: 100 }
      }
    );

    const activeWeights = result.components
      .filter(component => component.weight > 0)
      .reduce((total, component) => total + component.weight, 0);

    expect(result.availableWeight).toBe(0.46);
    expect(activeWeights).toBeCloseTo(1, 4);
    expect(result.missingMetrics).toContain('minutesPerPlayer');
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns zero score when every metric is missing', () => {
    const result = computeHypeScore({}, {});

    expect(result.score).toBe(0);
    expect(result.availableWeight).toBe(0);
    expect(result.components.every(component => component.contribution === 0)).toBe(true);
  });
});
