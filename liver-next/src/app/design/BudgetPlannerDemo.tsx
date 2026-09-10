'use client';

import { BudgetPlanner } from '@/components/app/BudgetPlanner';

/** The planner, opened so it can be looked at: the component collapses to
 *  a button on the money tab, which is right there and useless here. */
export function BudgetPlannerDemo() {
  return (
    <BudgetPlanner
      clientId="00000000-0000-4000-8000-000000000003"
      defaultOpen
      current={{
        total: 260000, guests: 180, must: ['photo'], nice: ['invites', 'other'],
        splits: { venue: 50, bar: 5, photo: 15, music: 5, design: 8, look: 5, invites: 1, transport: 2, other: 2, contingency: 7 },
      }}
      target={260000}
      guestEstimate={180}
    />
  );
}
