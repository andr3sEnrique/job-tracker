'use client';

import { ApplicationsOverTimeChart } from './applications-over-time-chart';
import { FunnelCard } from './funnel-card';
import { KpiCards } from './kpi-cards';
import { RecentActivity } from './recent-activity';
import { SourceCard } from './source-card';
import { StatusDistributionChart } from './status-distribution-chart';
import { QueryError } from '@/components/query-error';
import { useDashboardStats } from '@/lib/api/queries';

export function DashboardOverview() {
  const { data, isError, refetch } = useDashboardStats();

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <>
      <KpiCards summary={data?.summary} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ApplicationsOverTimeChart data={data?.timeline} />
        <StatusDistributionChart data={data?.statusDistribution} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <FunnelCard funnel={data?.funnel} />
        <SourceCard data={data?.sourceDistribution} />
        <RecentActivity items={data?.recentActivity} />
      </div>
    </>
  );
}
