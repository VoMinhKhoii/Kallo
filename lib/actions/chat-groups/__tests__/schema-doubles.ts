// Column-name doubles for `@/lib/db/schema`, shared by the chat-group suites
// that drive the default `db` singleton through a mock. Export EVERY table the
// modules under test import — a missing one makes the module-level import
// `undefined` and breaks unrelated queries.

export const chatGroups = {
  id: 'cg.id',
  kind: 'cg.kind',
  name: 'cg.name',
  createdBy: 'cg.createdBy',
  directUserLow: 'cg.directUserLow',
  directUserHigh: 'cg.directUserHigh',
  avatarSeed: 'cg.avatarSeed',
  updatedAt: 'cg.updatedAt',
};

export const chatGroupMembers = {
  id: 'cgm.id',
  groupId: 'cgm.groupId',
  userId: 'cgm.userId',
  role: 'cgm.role',
  lastReadAt: 'cgm.lastReadAt',
  joinedAt: 'cgm.joinedAt',
};

export const chatGroupMessages = {
  id: 'cgmsg.id',
  groupId: 'cgmsg.groupId',
  senderId: 'cgmsg.senderId',
  body: 'cgmsg.body',
  createdAt: 'cgmsg.createdAt',
};

export const friendships = {
  id: 'f.id',
  status: 'f.status',
  userLow: 'f.userLow',
  userHigh: 'f.userHigh',
};

export const meals = {
  id: 'm.id',
  userId: 'm.userId',
};

export const mealShares = {
  id: 'ms.id',
  mealId: 'ms.mealId',
  actorId: 'ms.actorId',
  visibility: 'ms.visibility',
  sharedAt: 'ms.sharedAt',
};

export const publicProfiles = {
  userId: 'pp.userId',
  handle: 'pp.handle',
  displayName: 'pp.displayName',
  avatarSeed: 'pp.avatarSeed',
  avatarUrl: 'pp.avatarUrl',
};
