import { SuperbirdError, invalidOperation } from './errors.js';
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function withTimeout(promise, ms, what) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new SuperbirdError('timeout', `${what} timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        clearTimeout(timer);
    }
}
export async function retry(attempts, delayMs, fn) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < attempts - 1)
                await sleep(delayMs);
        }
    }
    throw lastError;
}
export async function toBytes(source) {
    if (source instanceof Uint8Array)
        return source;
    if (source instanceof ArrayBuffer)
        return new Uint8Array(source);
    return new Uint8Array(await source.arrayBuffer());
}
export function hex(value) {
    return `0x${value.toString(16)}`;
}
export function isAscii(text) {
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 0x7f)
            return false;
    }
    return true;
}
export class ByteReader {
    reader;
    pending = null;
    constructor(stream) {
        this.reader = stream.getReader();
    }
    async readExact(length) {
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
    async cancel() {
        await this.reader.cancel().catch(() => { });
    }
}
export async function resolveStream(source) {
    if (source instanceof Blob) {
        return { reader: new ByteReader(source.stream()), size: source.size };
    }
    if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
        const bytes = await toBytes(source);
        return { reader: new ByteReader(new Blob([bytes]).stream()), size: bytes.length };
    }
    return { reader: new ByteReader(source.stream), size: source.size };
}
//# sourceMappingURL=util.js.map