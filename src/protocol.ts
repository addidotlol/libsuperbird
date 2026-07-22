export const VENDOR_ID = 0x1b8e;
export const PRODUCT_ID = 0xc003;
export const VENDOR_ID_BOOTED = 0x18d1;
export const PRODUCT_ID_BOOTED = 0x4e40;

export const ADDR_BL2 = 0xfffa0000;
export const ADDR_TMP = 0x1080000;
export const TRANSFER_SIZE_THRESHOLD = 8 * 1024 * 1024;

export const REQ_WRITE_MEM = 0x01;
export const REQ_READ_MEM = 0x02;
export const REQ_FILL_MEM = 0x03;
export const REQ_MODIFY_MEM = 0x04;
export const REQ_RUN_IN_ADDR = 0x05;
export const REQ_WRITE_AUX = 0x06;
export const REQ_READ_AUX = 0x07;
export const REQ_WR_LARGE_MEM = 0x11;
export const REQ_RD_LARGE_MEM = 0x12;
export const REQ_IDENTIFY_HOST = 0x20;
export const REQ_TPL_CMD = 0x30;
export const REQ_TPL_STAT = 0x31;
export const REQ_WRITE_MEDIA = 0x32;
export const REQ_READ_MEDIA = 0x33;
export const REQ_BULKCMD = 0x34;
export const REQ_PASSWORD = 0x35;
export const REQ_NOP = 0x36;
export const REQ_GET_AMLC = 0x50;
export const REQ_WRITE_AMLC = 0x60;

export const FLAG_KEEP_POWER_ON = 0x10;

export const AMLC_AMLS_BLOCK_LENGTH = 0x200;
export const AMLC_MAX_BLOCK_LENGTH = 0x4000;
export const AMLC_MAX_TRANSFER_LENGTH = 65536;

export const PART_SECTOR_SIZE = 512;
export const TRANSFER_BLOCK_SIZE = 8 * PART_SECTOR_SIZE;

export const COMMAND_TIMEOUT_MS = 10_000;
export const BULK_TIMEOUT_MS = 2_000;
