import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import IslandDetail from './IslandDetail';
import * as api from '../lib/api';

vi.mock('../lib/api');

describe('IslandDetail', () => {
  it('renders a regenerate button for AI research and calls API with refresh: true', async () => {
    (api.fetchIslandOverview as any).mockResolvedValue({
      island: { code: '0000-0000-0000', name: 'Test Island', creator: 'Test Creator', tags: [] },
      window: '10m',
      kpis: [],
      deltas: {},
      hypeScore: { score: 50, breakdown: [] },
      related: [],
      series: [],
      researchStatus: { available: true },
      updatedAt: '2025-01-01T00:00:00Z',
      degraded: false
    });
    
    (api.fetchIslandResearch as any).mockResolvedValue({
      summary: 'Initial Research',
      updatedAt: '2025-01-01T00:00:00Z'
    });

    render(
      <MemoryRouter initialEntries={['/island/0000-0000-0000']}>
        <Routes>
          <Route path="/island/:code" element={<IslandDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the overview to load
    await waitFor(() => expect(screen.getByText('Test Island')).toBeInTheDocument());
    
    // Check for the Regenerate button
    const regenBtn = await screen.findByRole('button', { name: /regenerate|再生成/i });
    expect(regenBtn).toBeInTheDocument();

    // Click it
    fireEvent.click(regenBtn);
    
    // Verify fetchIslandResearch was called with refresh: true
    await waitFor(() => {
      expect(api.fetchIslandResearch).toHaveBeenCalledWith('0000-0000-0000', undefined, undefined, true);
    });
  });
});
