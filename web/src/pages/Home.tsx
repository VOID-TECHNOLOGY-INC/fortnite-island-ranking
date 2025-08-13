import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import WindowSelector from '../components/WindowSelector';
import { RankingTable } from '../components/RankingTable';
import { fetchIslands } from '../lib/api';
import type { Island, TimeWindow } from '../lib/types';

export function Home() {
  const { t } = useTranslation();
  const [window, setWindow] = useState<TimeWindow>('10m');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('hype');

  const { data: islands, error, isLoading, mutate } = useSWR<Island[]>(
    ['islands', window, query, sort],
    () => fetchIslands({ window, query, sort })
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{t('home.title')}</h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder={t('search_placeholder') as string}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border px-2 py-1 rounded"
            style={{ marginRight: 12 }}
          />
          <WindowSelector value={window} onChange={setWindow} />
          <button onClick={() => mutate()} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            {t('refresh')}
          </button>
        </div>
      </div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {islands && <RankingTable islands={islands} />}
    </div>
  );
}


