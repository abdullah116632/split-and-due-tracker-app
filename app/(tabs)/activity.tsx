import { useState } from 'react';

import { ActivityList } from '@/components/activity-row';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { PageTitle, Screen } from '@/components/ui/screen';
import { listActivity, type ActivityFilter } from '@/db/activity';
import { useDbQuery } from '@/lib/use-db-query';

type Scope = NonNullable<ActivityFilter['scope']>;

export default function Activity() {
  const [scope, setScope] = useState<Scope>('all');
  const { data } = useDbQuery((db) => listActivity(db, { scope }), [scope]);

  return (
    <Screen edges={['top']}>
      <PageTitle title="Activity" subtitle="Every expense, debt and payment" />
      <SegmentedControl<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { value: 'all', label: 'All' },
          { value: 'groups', label: 'Groups' },
          { value: 'personal', label: 'Personal' },
        ]}
      />
      {data && data.length === 0 ? (
        <Card>
          <EmptyState icon="time-outline" title="No activity" message="Records you add will show up here." />
        </Card>
      ) : data ? (
        <ActivityList items={data} />
      ) : null}
    </Screen>
  );
}
