import 'server-only';
import { type SQL, sql } from 'drizzle-orm';
import {
  activePromoSql,
  payingSql,
} from '@/lib/admin/premium/targets/plan-sql';
import type { Who } from '@/lib/admin/premium/targets/who-input';

/**
 * The SQL condition (over `auth.users AS u`) selecting the NON-paying accounts
 * a Who names. Paying accounts are excluded for every kind, so no action here
 * can ever change a subscriber.
 */
export function whoCondition(who: Who): SQL {
  const notPaying = sql`NOT ${payingSql(sql`u.id`)}`;
  switch (who.kind) {
    case 'everyone':
      return notPaying;
    case 'users':
      return sql`${notPaying} AND u.id IN (${sql.join(
        who.userIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )})`;
    case 'group': {
      const parts: SQL[] = [notPaying];
      if (who.plan === 'free') {
        parts.push(sql`NOT ${activePromoSql(sql`u.id`)}`);
      } else if (who.plan === 'complimentary') {
        parts.push(activePromoSql(sql`u.id`));
      }
      if (who.joinedFrom) {
        parts.push(sql`u.created_at >= ${who.joinedFrom}::date`);
      }
      if (who.joinedTo) {
        parts.push(
          sql`u.created_at < (${who.joinedTo}::date + interval '1 day')`
        );
      }
      return sql.join(parts, sql` AND `);
    }
  }
}
