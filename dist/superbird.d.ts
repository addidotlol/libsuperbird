/// <reference types="w3c-web-usb" preserve="true" />
import { type PartitionName } from './partitions.js';
import { type BinarySource, type StreamSource } from './util.js';
export type SuperbirdMode = 'usb' | 'usb-burn' | 'normal';
export type ConnectStatus = 'connecting' | 'bl2-boot' | 'resetting' | 'waiting-reconnect' | 'connected';
export interface FlashProgress {
    percent: number;
    bytesWritten: number;
    totalBytes: number;
    elapsedMs: number;
    etaMs: number;
    rateKiBps: number;
    avgRateKiBps: number;
}
export interface SuperbirdConfig {
    stageChunkSize: number;
    transferBlockSize: number;
    bulkChunkSize: number | 'block';
    commandTimeoutMs: number;
    bulkTimeoutMs: number;
    writeRetries: number;
    cooldownMs: number;
    slowCommandMs: number;
    resetDelayMs: number;
    reconnectTimeoutMs: number;
}
export declare const DEFAULT_CONFIG: SuperbirdConfig;
export interface ConnectOptions {
    device?: USBDevice;
    bl2?: BinarySource;
    bootloader?: BinarySource;
    onStatus?: (status: ConnectStatus) => void;
    config?: Partial<SuperbirdConfig>;
}
export interface WriteOptions {
    onProgress?: (progress: FlashProgress) => void;
    signal?: AbortSignal;
    blockLength?: number;
}
export declare class Superbird {
    private usb;
    readonly config: SuperbirdConfig;
    private endpointIn;
    private endpointOut;
    private opened;
    private partitionTableLoaded;
    private constructor();
    configure(overrides: Partial<SuperbirdConfig>): this;
    static modeOf(device: USBDevice): SuperbirdMode;
    static getPairedDevices(): Promise<USBDevice[]>;
    static connect(options?: ConnectOptions): Promise<Superbird>;
    private static pickDevice;
    private static waitForBurnDevice;
    get usbDevice(): USBDevice;
    get mode(): SuperbirdMode;
    private open;
    close(): Promise<void>;
    private ensureOpen;
    private controlOut;
    private controlIn;
    private bulkOut;
    private bulkIn;
    identify(): Promise<string>;
    writeSimpleMemory(address: number, data: Uint8Array): Promise<void>;
    writeMemory(address: number, data: Uint8Array): Promise<void>;
    readSimpleMemory(address: number, length: number): Promise<Uint8Array>;
    readMemory(address: number, length: number): Promise<Uint8Array>;
    run(address: number, keepPower?: boolean): Promise<void>;
    bulkcmd(command: string): Promise<string>;
    writeLargeMemory(address: number, data: Uint8Array, blockLength?: number, appendZeros?: boolean): Promise<void>;
    bl2Boot(bl2: BinarySource, bootloader: BinarySource): Promise<void>;
    private getBootAmlc;
    private writeAmlcData;
    writeAmlcDataPacket(seq: number, amlcOffset: number, data: Uint8Array): Promise<void>;
    private ensurePartitionTable;
    validatePartitionSize(name: PartitionName): Promise<number>;
    restorePartition(name: PartitionName, data: StreamSource, options?: WriteOptions): Promise<void>;
    writeUserArea(lba: number, data: StreamSource, options?: WriteOptions): Promise<void>;
    writeBootPartition(hwpart: 1 | 2, data: BinarySource): Promise<void>;
    writeEnv(env: string, options?: {
        save?: boolean;
    }): Promise<void>;
    private stagedWrite;
}
//# sourceMappingURL=superbird.d.ts.map