import { useParams, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchIslandResearch, type Research } from '../lib/api';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function IslandDetail() {
  const { code } = useParams();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const name = useMemo(() => new URLSearchParams(location.search).get('name') || undefined, []);
  const lang = i18n.language?.startsWith('ja') ? 'ja' : 'en';
  const { data, isLoading, error } = useSWR<Research>(['research', code, name, lang], () => fetchIslandResearch(code!, name, lang));

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header" style={{ gap: 12 }}>
          <button className="btn" onClick={() => navigate(-1)} aria-label="Back" title="Back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
            </svg>
          </button>
          <h2 className="card-title break-anywhere" style={{ marginRight: 'auto' }}>{name || code}</h2>
          <span className="badge">{code}</span>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Auto research powered by Perplexity</div>
      </div>

      {isLoading && (
        <div className="card">
          <div className="loading-row"><span className="spinner" /> Loading research...</div>
        </div>
      )}
      {error && <div className="card text-red-500">Error: {String((error as any)?.message || error)}</div>}

      {data && (
        <>
          <div className="card">
            <div className="section-title">Island Status</div>
            {(() => {
              const md = (data.summary || '').replace(/盛り上がり状況/g, '状況');
              const html = DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
              return <div className="prose prose-invert text-sm leading-relaxed break-anywhere" dangerouslySetInnerHTML={{ __html: html }} />;
            })()}
          </div>

          {/* Highlights removed as it overlaps with Island Status content */}

          {data.sources && data.sources.length > 0 && (
            <div className="card">
              <div className="section-title">Sources</div>
              <div className="grid-2">
                {data.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="btn break-anywhere">{s.title || s.url}</a>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs muted">Updated at: {new Date(data.updatedAt).toLocaleString()}</div>
        </>
      )}
    </div>
  );
}


