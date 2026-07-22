export interface MetaFile {
    filePath: string;
    encoding?: string;
}
export type DataOrFile = number[] | MetaFile;
export type StringOrFile = string | MetaFile;
export type WaitValue = {
    type: 'userInput';
    message: string;
} | {
    type: 'time';
    time: number;
};
export type FlashStep = {
    type: 'identify';
    variable?: string;
} | {
    type: 'bulkcmd';
    value: string;
} | {
    type: 'bulkcmdStat';
    value: string;
    variable?: string;
} | {
    type: 'run';
    value: {
        address: number;
        keepPower?: boolean;
    };
} | {
    type: 'writeSimpleMemory';
    value: {
        address: number;
        data: DataOrFile;
    };
} | {
    type: 'writeLargeMemory';
    value: {
        address: number;
        data: DataOrFile;
        blockLength: number;
        appendZeros?: boolean;
    };
} | {
    type: 'readSimpleMemory';
    value: {
        address: number;
        length: number;
    };
    variable?: string;
} | {
    type: 'readLargeMemory';
    value: {
        address: number;
        length: number;
    };
    variable?: string;
} | {
    type: 'getBootAMLC';
    variable?: string;
} | {
    type: 'writeAMLCData';
    value: {
        seq: number;
        amlcOffset: number;
        data: DataOrFile;
    };
} | {
    type: 'bl2Boot';
    value: {
        bl2: DataOrFile;
        bootloader: DataOrFile;
    };
} | {
    type: 'validatePartitionSize';
    value: {
        name: string;
    };
    variable?: string;
} | {
    type: 'restorePartition';
    value: {
        name: string;
        data: DataOrFile;
    };
} | {
    type: 'writeBootPartition';
    value: {
        hwpart: number;
        data: DataOrFile;
    };
} | {
    type: 'writeUserArea';
    value: {
        lba: number;
        data: DataOrFile;
    };
} | {
    type: 'writeEnv';
    value: StringOrFile;
} | {
    type: 'log';
    value: string;
} | {
    type: 'wait';
    value: WaitValue;
};
export interface FlashConfig {
    name: string;
    version: string;
    description: string;
    steps: FlashStep[];
    variables?: Record<string, number>;
    metadataVersion: number;
}
export declare function parseFlashConfig(input: string | unknown): FlashConfig;
export declare const STOCK_META: FlashConfig;
//# sourceMappingURL=meta.d.ts.map