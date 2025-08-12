import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchIslandResearch, type Research } from '../lib/api';

export default function IslandDetail() {
  const { code } = useParams();
  const { i18n } = useTranslation();
  const name = useMemo(() => new URLSearchParams(location.search).get('name') || undefined, []);
  const lang = i18n.language?.startsWith('ja') ? 'ja' : 'en';
  const { data, isLoading, error } = useSWR<Research>(['research', code, name, lang], () => fetchIslandResearch(code!, name, lang));

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{name ? `${name} (${code})` : code}</h2>
        <div style={{ flex: 1 }} />
      </div>
      {isLoading && <div>Loading...</div>}
      {error && <div className="text-red-500">Error: {String((error as any)?.message || error)}</div>}
      {data && (
        <div className="space-y-4">
          <section>
            <h3 className="font-semibold mb-2">Overview</h3>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{data.summary}</div>
          </section>
          {data.highlights && data.highlights.length > 0 && (
            <section>
              <h3 className="font-semibold mb-2">Highlights</h3>
              <ul className="list-disc pl-6 text-sm">
                {data.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </section>
          )}
          {data.sources && data.sources.length > 0 && (
            <section>
              <h3 className="font-semibold mb-2">Sources</h3>
              <ul className="list-disc pl-6 text-sm break-all">
                {data.sources.map((s, i) => (
                  <li key={i}><a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{s.title || s.url}</a></li>
                ))}
              </ul>
            </section>
          )}
          <div className="text-xs text-gray-400">Updated at: {new Date(data.updatedAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}


