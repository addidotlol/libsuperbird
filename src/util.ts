import { SuperbirdError, invalidOperation } from './errors.js';

export type BinarySource = Blob | ArrayBuffer | Uint8Array;
export type StreamSource = BinarySource | { stream: ReadableStream<Uint8Array>; size: number };

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SuperbirdError('timeout', `${what} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function retry<T>(attempts: number, delayMs: number, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(delayMs);
    }
  }
  throw lastError;
}

export async function toBytes(source: BinarySource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(await source.arrayBuffer());
}

export function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

export function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

export interface ByteSegment {
  start: number;
  end: number;
}

export function nonZeroSegments(data: Uint8Array, granularity: number, minSkipBytes: number): ByteSegment[] {
  const blockCount = Math.ceil(data.length / granularity);
  const runs: ByteSegment[] = [];
  let runStart = -1;
  for (let i = 0; i < blockCount; i++) {
    const start = i * granularity;
    const zero = isZeroRegion(data, start, Math.min(granularity, data.length - start));
    if (!zero && runStart < 0) runStart = i;
    if (zero && runStart >= 0) {
      runs.push({ start: runStart, end: i });
      runStart = -1;
    }
  }
  if (runStart >= 0) runs.push({ start: runStart, end: blockCount });

  const minGapBlocks = Math.max(1, Math.ceil(minSkipBytes / granularity));
  const merged: ByteSegment[] = [];
  for (const run of runs) {
    const previous = merged[merged.length - 1];
    if (previous && run.start - previous.end < minGapBlocks) previous.end = run.end;
    else merged.push({ ...run });
  }
  return merged.map(run => ({
    start: run.start * granularity,
    end: Math.min(run.end * granularity, data.length),
  }));
}

function isZeroRegion(data: Uint8Array, start: number, length: number): boolean {
  const end = start + length;
  let i = start;
  if ((data.byteOffset + i) % 8 === 0) {
    const words = new BigUint64Array(data.buffer, data.byteOffset + i, Math.floor((end - i) / 8));
    for (const word of words) if (word !== 0n) return false;
    i += words.length * 8;
  }
  for (; i < end; i++) if (data[i] !== 0) return false;
  return true;
}

export class ByteReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private pending: Uint8Array | null = null;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async readExact(length: number): Promise<Uint8Array> {
    const out = new Uint8Array(length);
    let filled = 0;
    while (filled < length) {
      if (this.pending && this.pending.length > 0) {
        const take = Math.min(this.pending.length, length - filled);
        out.set(this.pending.subarray(0, take), filled);
        filled += take;
        this.pending = take < this.pending.length ? this.pending.subarray(take) : null;
        continue;
      }
      const { done, value } = await this.reader.read();
      if (done) {
        throw invalidOperation(`unexpected end of stream: needed ${length} bytes, got ${filled}`);
      }
      this.pending = value;
    }
    return out;
  }

  async cancel(): Promise<void> {
    await this.reader.cancel().catch(() => {});
  }
}

export async function resolveStream(source: StreamSource): Promise<{ reader: ByteReader; size: number }> {
  if (source instanceof Blob) {
    return { reader: new ByteReader(source.stream()), size: source.size };
  }
  if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
    const bytes = await toBytes(source);
    return { reader: new ByteReader(new Blob([bytes as BlobPart]).stream()), size: bytes.length };
  }
  return { reader: new ByteReader(source.stream), size: source.size };
}
