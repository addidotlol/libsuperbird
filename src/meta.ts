import { SuperbirdError } from './errors.js';

export interface MetaFile {
  filePath: string;
  encoding?: string;
}

export type DataOrFile = number[] | MetaFile;
export type StringOrFile = string | MetaFile;

export type WaitValue = { type: 'userInput'; message: string } | { type: 'time'; time: number };

export type FlashStep =
  | { type: 'identify'; variable?: string }
  | { type: 'bulkcmd'; value: string }
  | { type: 'bulkcmdStat'; value: string; variable?: string }
  | { type: 'run'; value: { address: number; keepPower?: boolean } }
  | { type: 'writeSimpleMemory'; value: { address: number; data: DataOrFile } }
  | { type: 'writeLargeMemory'; value: { address: number; data: DataOrFile; blockLength: number; appendZeros?: boolean } }
  | { type: 'readSimpleMemory'; value: { address: number; length: number }; variable?: string }
  | { type: 'readLargeMemory'; value: { address: number; length: number }; variable?: string }
  | { type: 'getBootAMLC'; variable?: string }
  | { type: 'writeAMLCData'; value: { seq: number; amlcOffset: number; data: DataOrFile } }
  | { type: 'bl2Boot'; value: { bl2: DataOrFile; bootloader: DataOrFile } }
  | { type: 'validatePartitionSize'; value: { name: string }; variable?: string }
  | { type: 'restorePartition'; value: { name: string; data: DataOrFile } }
  | { type: 'writeBootPartition'; value: { hwpart: number; data: DataOrFile } }
  | { type: 'writeUserArea'; value: { lba: number; data: DataOrFile } }
  | { type: 'writeEnv'; value: StringOrFile }
  | { type: 'log'; value: string }
  | { type: 'wait'; value: WaitValue };

export interface FlashConfig {
  name: string;
  version: string;
  description: string;
  steps: FlashStep[];
  variables?: Record<string, number>;
  metadataVersion: number;
}

const SUPPORTED_META_VERSION_MIN = 1;
const SUPPORTED_META_VERSION_MAX = 2;

const UNSUPPORTED_STEP_TYPES = new Set([
  'identify',
  'bulkcmdStat',
  'readSimpleMemory',
  'readLargeMemory',
  'getBootAMLC',
  'validatePartitionSize',
]);

function configError(message: string): SuperbirdError {
  return new SuperbirdError('config', message);
}

export function parseFlashConfig(input: string | unknown): FlashConfig {
  let raw: unknown;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      throw new SuperbirdError('config', 'meta.json is not valid JSON', { cause: error });
    }
  } else {
    raw = input;
  }

  if (typeof raw !== 'object' || raw === null) throw configError('meta.json must be an object');
  const config = raw as FlashConfig;

  if (typeof config.metadataVersion !== 'number') throw configError('meta.json is missing metadataVersion');
  if (config.metadataVersion < SUPPORTED_META_VERSION_MIN || config.metadataVersion > SUPPORTED_META_VERSION_MAX) {
    throw configError(`unsupported meta.json version: ${config.metadataVersion}`);
  }
  if (!Array.isArray(config.steps)) throw configError('meta.json is missing steps');

  for (const step of config.steps) {
    if (typeof step !== 'object' || step === null || typeof step.type !== 'string') {
      throw configError(`malformed step: ${JSON.stringify(step)}`);
    }
    if (UNSUPPORTED_STEP_TYPES.has(step.type)) {
      throw configError(`unsupported meta.json step: ${step.type}`);
    }
    if (step.type === 'wait' && step.value.type === 'userInput') {
      throw configError('unsupported meta.json step: wait for user input');
    }
  }

  return config;
}

export const STOCK_META: FlashConfig = {
  name: 'stock partitions',
  version: '1.0.0',
  description: 'stock partitions',
  metadataVersion: 1,
  steps: [
    { type: 'bulkcmd', value: 'amlmmc part 1' },
    { type: 'restorePartition', value: { name: 'env', data: { filePath: 'env.dump' } } },
    { type: 'restorePartition', value: { name: 'fip_a', data: { filePath: 'fip_a.dump' } } },
    { type: 'restorePartition', value: { name: 'fip_b', data: { filePath: 'fip_b.dump' } } },
    { type: 'restorePartition', value: { name: 'logo', data: { filePath: 'logo.dump' } } },
    { type: 'restorePartition', value: { name: 'dtbo_a', data: { filePath: 'dtbo_a.dump' } } },
    { type: 'restorePartition', value: { name: 'dtbo_b', data: { filePath: 'dtbo_b.dump' } } },
    { type: 'restorePartition', value: { name: 'vbmeta_a', data: { filePath: 'vbmeta_a.dump' } } },
    { type: 'restorePartition', value: { name: 'vbmeta_b', data: { filePath: 'vbmeta_b.dump' } } },
    { type: 'restorePartition', value: { name: 'boot_a', data: { filePath: 'boot_a.dump' } } },
    { type: 'restorePartition', value: { name: 'boot_b', data: { filePath: 'boot_b.dump' } } },
    { type: 'restorePartition', value: { name: 'system_a', data: { filePath: 'system_a.ext2' } } },
    { type: 'restorePartition', value: { name: 'system_b', data: { filePath: 'system_b.ext2' } } },
    { type: 'restorePartition', value: { name: 'misc', data: { filePath: 'misc.dump' } } },
    { type: 'restorePartition', value: { name: 'bootloader', data: { filePath: 'bootloader.dump' } } },
    { type: 'writeEnv', value: { filePath: 'env.txt' } },
    { type: 'bulkcmd', value: 'saveenv' },
  ],
};
