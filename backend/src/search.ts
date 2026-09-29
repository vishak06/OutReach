import { Client } from '@elastic/elasticsearch';
import prisma from './db';
import { config } from './config';
import type { EmailRecord, EmailSearchResult } from './types';

const indexName = 'reachinbox-emails';

const client = new Client({
  node: config.elasticsearchUrl,
});

let searchReady = true;

async function ensureIndex(): Promise<void> {
  if (!searchReady) {
    return;
  }

  try {
    const exists = await client.indices.exists({ index: indexName });

    if (!exists) {
      await client.indices.create({
        index: indexName,
        mappings: {
          properties: {
            subject: { type: 'text' },
            body: { type: 'text' },
            to: { type: 'text' },
            from: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            userId: { type: 'keyword' },
          },
        },
      });
    }
  } catch {
    searchReady = false;
  }
}

function toSearchResult(email: EmailRecord): EmailSearchResult {
  return {
    id: email.id,
    subject: email.subject,
    body: email.body,
    to: email.to,
    from: email.from,
    status: email.status,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt ? email.sentAt.toISOString() : null,
  };
}

export async function indexEmail(email: EmailRecord): Promise<void> {
  if (!searchReady) {
    return;
  }

  await ensureIndex();

  if (!searchReady) {
    return;
  }

  try {
    await client.index({
      index: indexName,
      id: email.id,
      document: {
        id: email.id,
        subject: email.subject,
        body: email.body,
        to: email.to,
        from: email.from,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        userId: email.userId,
      },
      refresh: true,
    });
  } catch {
    searchReady = false;
  }
}

export async function refreshEmailIndex(emailId: string): Promise<void> {
  const email = await prisma.email.findUnique({ where: { id: emailId } });

  if (!email) {
    return;
  }

  await indexEmail(email as EmailRecord);
}

export async function searchEmails(userId: string, query: string): Promise<EmailSearchResult[]> {
  await ensureIndex();

  if (searchReady) {
    try {
      const response = await client.search<{ id: string; subject: string; body: string; to: string; from: string; status: string; scheduledAt: string; sentAt: string | null }>({
        index: indexName,
        query: {
          bool: {
            must: [{ term: { userId } }],
            should: [
              { match_phrase_prefix: { subject: query } },
              { match: { body: query } },
              { match: { to: query } },
            ],
            minimum_should_match: 1,
          },
        },
        size: 20,
      });

      return response.hits.hits.flatMap((hit) => {
        const source = hit._source;
        if (!source) {
          return [];
        }

        return [source as EmailSearchResult];
      });
    } catch {
      searchReady = false;
    }
  }

  const emails = await prisma.email.findMany({
    where: {
      userId,
      OR: [
        { subject: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
        { to: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return emails.map(toSearchResult);
}
