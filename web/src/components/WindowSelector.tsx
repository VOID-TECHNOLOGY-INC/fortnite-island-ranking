import { useTranslation } from 'react-i18next';

type Props = { value: '10m' | '1h' | '24h'; onChange: (v: '10m' | '1h' | '24h') => void };
export default function WindowSelector({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <label>
      {t('filters.window')}:&nbsp;
      <select value={value} onChange={(e) => onChange(e.target.value as any)}>
        <option value="10m">{t('windows.10m')}</option>
        <option value="1h">{t('windows.1h')}</option>
        <option value="24h">{t('windows.24h')}</option>
      </select>
    </label>
  );
}


