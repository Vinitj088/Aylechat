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
      "isOwner",
      "isLoggedIn && auth.id in data.ref('user.id')",
    ],
    allow: {
      view: "isOwner || data.isPublic",
      create: "isLoggedIn",
      delete: "isOwner",
      update: "isOwner",
    },
  },
  messages: {
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isThreadOwner",
      "isLoggedIn && auth.id in data.ref('thread.user.id')",
    ],
    allow: {
      view: "isThreadOwner || data.ref('thread.isPublic')[0] == true",
      create: "isLoggedIn",
      delete: "isThreadOwner",
      update: "isThreadOwner",
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
