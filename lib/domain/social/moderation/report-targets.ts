// ---------------------------------------------------------------------------
// Report targets — does the reported thing exist, may the reporter have seen
// it, and whose is it?
// ---------------------------------------------------------------------------
// A report names its target by kind + id; the reported PERSON is derived here,
// never taken from the client. Admission mirrors what the reporter could have
// been looking at:
//   - share / reply: the share-visibility rule IGNORING blocks
//     (shareVisibleIgnoringBlocksSql) — owner, else non-private and a live
//     relationship — so "block, then report" still works while the reporter
//     is in a group with the author. It is NOT widened for a block: blocking a
//     stranger must never make their private share reportable (that would
//     confirm the share exists and mail its text to the admins);
//   - chat_message / chat_group: the reporter is a member of the chat (not
//     the direct-chat friendship check — a block closes that too);
//   - profile: any existing circle profile (profiles are reachable by invite
//     link, so there is no narrower rule to apply).
// Anything else is null, which the caller turns into the same 404 as a
// missing target, so the endpoint is not an oracle for other people's ids.

import { and, eq } from 'drizzle-orm';
import type { ReportTargetKind } from '@/lib/api/contracts/social/moderation';
import { shareVisibleIgnoringBlocksSql } from '@/lib/domain/social/shares/share-visibility';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  mealShareReplies,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

export interface ReportTarget {
  /** The person whose content this is. */
  ownerId: string;
  /** A short copy of the reported text for the admin email, when there is
   * one (a reply, a message, a group or display name, a meal description). */
  excerpt: string | null;
}

const EXCERPT_MAX = 280;

const excerptOf = (text: string | null | undefined) =>
  text ? text.slice(0, EXCERPT_MAX) : null;

/** Admission for a share (or a reply on one), folded into the row read's
 * WHERE — which Drizzle renders fully qualified, and both reads join, so the
 * single-table column-stripping hazard in share-visibility.ts cannot apply. */
const reporterCouldSee = (reporterId: string) =>
  shareVisibleIgnoringBlocksSql(
    reporterId,
    mealShares.actorId,
    mealShares.sharedAt,
    mealShares.visibility
  );

async function isChatMember(
  reporterId: string,
  groupId: string,
  db: Db
): Promise<boolean> {
  const rows = await db
    .select({ groupId: chatGroupMembers.groupId })
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, reporterId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function shareTarget(reporterId: string, shareId: string, db: Db) {
  const [row] = await db
    .select({ actorId: mealShares.actorId, rawInput: meals.rawInput })
    .from(mealShares)
    .innerJoin(meals, eq(meals.id, mealShares.mealId))
    .where(and(eq(mealShares.id, shareId), reporterCouldSee(reporterId)))
    .limit(1);
  if (!row) return null;
  return { ownerId: row.actorId, excerpt: excerptOf(row.rawInput) };
}

async function replyTarget(reporterId: string, replyId: string, db: Db) {
  const [row] = await db
    .select({ authorId: mealShareReplies.userId, body: mealShareReplies.body })
    .from(mealShareReplies)
    .innerJoin(mealShares, eq(mealShares.id, mealShareReplies.shareId))
    .where(and(eq(mealShareReplies.id, replyId), reporterCouldSee(reporterId)))
    .limit(1);
  if (!row) return null;
  return { ownerId: row.authorId, excerpt: excerptOf(row.body) };
}

async function chatMessageTarget(
  reporterId: string,
  messageId: string,
  db: Db
) {
  const [row] = await db
    .select({
      senderId: chatGroupMessages.senderId,
      groupId: chatGroupMessages.groupId,
      body: chatGroupMessages.body,
    })
    .from(chatGroupMessages)
    .where(eq(chatGroupMessages.id, messageId))
    .limit(1);
  if (!row || !(await isChatMember(reporterId, row.groupId, db))) return null;
  return { ownerId: row.senderId, excerpt: excerptOf(row.body) };
}

async function chatGroupTarget(reporterId: string, groupId: string, db: Db) {
  const [row] = await db
    .select({ createdBy: chatGroups.createdBy, name: chatGroups.name })
    .from(chatGroups)
    .where(and(eq(chatGroups.id, groupId), eq(chatGroups.kind, 'group')))
    .limit(1);
  if (!row || !(await isChatMember(reporterId, groupId, db))) return null;
  return { ownerId: row.createdBy, excerpt: excerptOf(row.name) };
}

async function profileTarget(userId: string, db: Db) {
  const [row] = await db
    .select({
      userId: publicProfiles.userId,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    ownerId: row.userId,
    excerpt: excerptOf(
      row.displayName ? `${row.displayName} (@${row.handle})` : row.handle
    ),
  };
}

/** The reported target's owner and excerpt, or null when it does not exist or
 * the reporter could not have seen it. */
export async function resolveReportTarget(
  reporterId: string,
  kind: ReportTargetKind,
  targetId: string,
  db: Db
): Promise<ReportTarget | null> {
  switch (kind) {
    case 'share':
      return shareTarget(reporterId, targetId, db);
    case 'reply':
      return replyTarget(reporterId, targetId, db);
    case 'chat_message':
      return chatMessageTarget(reporterId, targetId, db);
    case 'chat_group':
      return chatGroupTarget(reporterId, targetId, db);
    case 'profile':
      return profileTarget(targetId, db);
  }
}
