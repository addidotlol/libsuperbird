export type BinarySource = Blob | ArrayBuffer | Uint8Array;
export type StreamSource = BinarySource | {
    stream: ReadableStream<Uint8Array>;
    size: number;
};
export declare function sleep(ms: number): Promise<void>;
export declare function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T>;
export declare function retry<T>(attempts: number, delayMs: number, fn: () => Promise<T>): Promise<T>;
export declare function toBytes(source: BinarySource): Promise<Uint8Array>;
export declare function hex(value: number): string;
export declare function isAscii(text: string): boolean;
export declare class ByteReader {
    private reader;
    private pending;
    constructor(stream: ReadableStream<Uint8Array>);
    readExact(length: number): Promise<Uint8Array>;
    cancel(): Promise<void>;
}
export declare function resolveStream(source: StreamSource): Promise<{
    reader: ByteReader;
    size: number;
}>;
//# sourceMappingURL=util.d.ts.map