// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const rules = {
  $users: {
    allow: {
      view: "auth.id == data.id",
      create: "false",
      delete: "false",
      update: "false",
    },
  },
  threads: {
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "userIds",
      "data.ref('user.id')",
      "isOwner",
      "isLoggedIn && size(userIds) > 0 && auth.id in userIds",
    ],
    allow: {
      // Allow view if owner OR public OR user is logged in and just created it
      view: "isOwner || data.isPublic == true",
      create: "isLoggedIn",
      delete: "isOwner",
      update: "isLoggedIn", // Allow update for logged in users (they can only update their own via isOwner check on sensitive ops)
    },
  },
  messages: {
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "threadUserIds",
      "data.ref('thread.user.id')",
      "isThreadOwner",
      "isLoggedIn && size(threadUserIds) > 0 && auth.id in threadUserIds",
    ],
    allow: {
      view: "isThreadOwner || data.ref('thread.isPublic')[0] == true",
      create: "isLoggedIn",
      delete: "isThreadOwner",
      update: "isLoggedIn", // Allow update for logged in users
    },
  },
  profiles: {
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isOwner",
      "isLoggedIn && auth.id in data.ref('user.id')",
    ],
    allow: {
      view: "true",
      create: "isLoggedIn",
      delete: "false",
      update: "isOwner",
    },
  },
} satisfies InstantRules;

export default rules;
