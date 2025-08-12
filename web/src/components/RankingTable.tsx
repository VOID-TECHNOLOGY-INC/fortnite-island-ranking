import { Link } from 'react-router-dom';
import type { Island } from '../lib/types';

type Props = {
  islands: Island[];
};

export function RankingTable({ islands }: Props) {
  if (islands.length === 0) return <p>No data</p>;

  return (
    <table className="table islands-table">
      <colgroup>
        <col style={{ width: 48 }} />
        <col />
      </colgroup>
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            #
          </th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Island
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {islands.map((island, index) => (
          <tr key={island.code}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 island-cell">
              <Link to={`/island/${island.code}?name=${encodeURIComponent(island.name)}`} className="hover:underline">
                <div className="island-name">{island.name}</div>
                <div className="text-xs text-gray-400 island-meta">
                  {island.code} &middot; {island.creator}
                </div>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


