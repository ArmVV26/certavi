import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { OptionalBlock } from '../../domain';
import { readBlocks } from '../../data/blocks';
import { useDatabase } from '../../data/DatabaseContext';
import { useLocale } from '../../i18n/LocaleContext';
import { resolveText } from '../../i18n/text';
import { buttonClasses } from '../../ui/buttonClasses';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import styles from './Blocks.module.css';
import { blockSummary } from './blockText';

/** `/settings/blocks`: the optional blocks, active ones first, and the way to make a new one. */
export function BlocksPage() {
  const { t } = useTranslation();
  const db = useDatabase();
  const blocks = useLiveQuery(() => readBlocks(db), [db]);
  if (!blocks) return null;

  return (
    <div className={styles.page}>
      <Link to="/settings" className={styles.back}>
        <Icon name="back" size={20} />
        <span>{t('settings.sync.back')}</span>
      </Link>
      <Link to="/settings/blocks/new" className={buttonClasses({ variant: 'primary' })}>
        {t('blocksPage.new')}
      </Link>
      {blocks.length === 0 && (
        <EmptyState
          icon="info"
          title={t('blocksPage.empty')}
          description={t('blocksPage.emptyText')}
        />
      )}
      <BlockSection title={t('blocksPage.active')} blocks={blocks.filter((b) => b.active)} />
      <BlockSection title={t('blocksPage.inactive')} blocks={blocks.filter((b) => !b.active)} />
    </div>
  );
}

function BlockSection({ title, blocks }: { title: string; blocks: readonly OptionalBlock[] }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  if (blocks.length === 0) return null;
  return (
    <Card element="section">
      <h2 className={styles.heading}>{title}</h2>
      <ul className={styles.list}>
        {blocks.map((block) => (
          <li key={block.id}>
            <Link to={`/settings/blocks/${block.id}`} className={styles.block}>
              <span className={styles.blockText}>
                <strong>{resolveText(t, block.name)}</strong>
                <span className={styles.muted}>
                  {t(`blocksPage.types.${block.blockType}`)} · {blockSummary(t, locale, block)}
                </span>
              </span>
              <Icon name="chevronRight" size={20} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
