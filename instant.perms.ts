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
  profiles: {
    allow: {
      view: "true",
      create: "isLoggedIn",
      update: "isOwner",
      delete: "false",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isOwner",
      "isLoggedIn && auth.id in data.ref('user.id')",
    ],
  },
  threads: {
    allow: {
      view: "isOwner || data.isPublic",
      create: "isLoggedIn",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isOwner",
      "isLoggedIn && auth.id in data.ref('user.id')",
    ],
  },
  messages: {
    allow: {
      view: "isThreadOwner || data.ref('thread.isPublic')[0] == true",
      create: "isLoggedIn",
      // TODO: should users be able to update/delete messages?
      update: "false",
      delete: "false",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isThreadOwner",
      "isLoggedIn && auth.id in data.ref('thread.user.id')",
    ],
  },
} satisfies InstantRules;

export default rules;
