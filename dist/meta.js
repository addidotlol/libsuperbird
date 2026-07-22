import { SuperbirdError } from './errors.js';
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
function configError(message) {
    return new SuperbirdError('config', message);
}
export function parseFlashConfig(input) {
    let raw;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        }
        catch (error) {
            throw new SuperbirdError('config', 'meta.json is not valid JSON', { cause: error });
        }
    }
    else {
        raw = input;
    }
    if (typeof raw !== 'object' || raw === null)
        throw configError('meta.json must be an object');
    const config = raw;
    if (typeof config.metadataVersion !== 'number')
        throw configError('meta.json is missing metadataVersion');
    if (config.metadataVersion < SUPPORTED_META_VERSION_MIN || config.metadataVersion > SUPPORTED_META_VERSION_MAX) {
        throw configError(`unsupported meta.json version: ${config.metadataVersion}`);
    }
    if (!Array.isArray(config.steps))
        throw configError('meta.json is missing steps');
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
export const STOCK_META = {
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
//# sourceMappingURL=meta.js.map