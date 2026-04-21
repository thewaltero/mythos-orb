export interface SessionEntry {
  timestamp: string;
  action: string;
  result: string;
}

export interface SessionMetadata {
  commit?: string;
  branch?: string;
  timestamp_end?: string;
}

export interface Session {
  id: number;
  timestamp_start: string;
  entries: SessionEntry[];
  metadata?: SessionMetadata;
  rawContent?: string;
}

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch('/api/sessions');
  return res.json();
}

export async function fetchDiff(hash: string): Promise<string> {
  const res = await fetch(`/api/diff?hash=${hash}`);
  return res.text();
}

/**
 * Commands the backend to open a file or directory in the system default handler
 */
export async function openPath(filePath?: string): Promise<void> {
  await fetch('/api/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath })
  });
}
