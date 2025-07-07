import { i } from '@instantdb/react';

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    threads: i.entity({
      title: i.string(),
      model: i.string(),
      createdAt: i.date().indexed(),
      updatedAt: i.date().indexed(),
      isPublic: i.boolean().indexed(),
      shareId: i.string().unique(),
    }),
    messages: i.entity({
      role: i.string(),
      content: i.string(),
      createdAt: i.date().indexed(),
    }),
    scrapedUrls: i.entity({
      url: i.string().unique(),
      markdownContent: i.string(),
      scrapedAt: i.date().indexed(),
    }),
  },
  links: {
    threadUser: {
      forward: { on: 'threads', has: 'one', label: 'user' },
      reverse: { on: '$users', has: 'many', label: 'threads' },
    },
    messageThread: {
      forward: { on: 'messages', has: 'one', label: 'thread', onDelete: 'cascade' },
      reverse: { on: 'threads', has: 'many', label: 'messages' },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
