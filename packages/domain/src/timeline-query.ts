export type TimelineStatus = 'draft' | 'shared' | 'revoked' | 'ignored' | 'deleted';

export type TimelineItem = { id: string; occurredAt: string; status: TimelineStatus };

export type Cursor = { occurredAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.occurredAt}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw?: string): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const index = decoded.lastIndexOf('|');
    if (index < 0) return null;
    const occurredAt = decoded.slice(0, index);
    const id = decoded.slice(index + 1);
    if (!occurredAt || !id || Number.isNaN(new Date(occurredAt).getTime())) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

export function compareDesc(a: TimelineItem, b: TimelineItem): number {
  const timeDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.id.localeCompare(a.id);
}

export function paginate<T extends TimelineItem>(
  items: T[],
  cursor: Cursor | null,
  limit: number,
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  const sorted = [...items].sort(compareDesc);
  const filtered = cursor
    ? sorted.filter((item) => {
        const time = new Date(item.occurredAt).getTime();
        const cursorTime = new Date(cursor.occurredAt).getTime();
        return time < cursorTime || (time === cursorTime && item.id < cursor.id);
      })
    : sorted;

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > page.length;
  const last = page[page.length - 1];
  return {
    items: page,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor({ occurredAt: last.occurredAt, id: last.id }) : null,
  };
}

export function groupByDay(items: TimelineItem[], now = new Date()): Array<{ label: string; items: TimelineItem[] }> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const groups = new Map<string, TimelineItem[]>();

  for (const item of items) {
    const date = new Date(item.occurredAt);
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const diffDays = Math.floor((today.getTime() - day.getTime()) / 86400000);
    const label = diffDays <= 0 ? '今天' : diffDays === 1 ? '昨天' : diffDays <= 7 ? '近七天' : '更早';
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }

  const order = ['今天', '昨天', '近七天', '更早'];
  return order.filter((label) => groups.has(label)).map((label) => ({ label, items: groups.get(label)! }));
}