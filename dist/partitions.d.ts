export interface PartitionInfo {
    offset: number;
    size: number;
    sizeAlt?: number;
}
export type PartitionName = 'bootloader' | 'reserved' | 'cache' | 'env' | 'fip_a' | 'fip_b' | 'logo' | 'dtbo_a' | 'dtbo_b' | 'vbmeta_a' | 'vbmeta_b' | 'boot_a' | 'boot_b' | 'system_a' | 'system_b' | 'misc' | 'settings' | 'data';
export declare const SUPERBIRD_PARTITIONS: Readonly<Record<PartitionName, PartitionInfo>>;
//# sourceMappingURL=partitions.d.ts.map