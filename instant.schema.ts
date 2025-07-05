// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    threads: i.entity({
      id: i.string().unique().indexed(),
      userId: i.string().indexed(),
      title: i.string(),
      model: i.string().optional(),
      createdAt: i.string(),
      updatedAt: i.string(),
      isPublic: i.boolean().optional(),
      shareId: i.string().optional(),
    }),
    messages: i.entity({
      id: i.string().unique().indexed(),
      threadId: i.string().indexed(),
      role: i.string(),
      content: i.string(),
      citations: i.any().optional(),
      completed: i.boolean().optional(),
      images: i.any().optional(),
      attachments: i.any().optional(),
      startTime: i.number().optional(),
      endTime: i.number().optional(),
      tps: i.number().optional(),
      createdAt: i.string().optional(),
    }),
  },
  links: {
    userThreads: {
      forward: { on: 'threads', has: 'one', label: 'user' },
      reverse: { on: '$users', has: 'many', label: 'threads' },
    },
    messageThread: {
      forward: { on: 'messages', has: 'one', label: 'thread' },
      reverse: { on: 'threads', has: 'many', label: 'messages' },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
