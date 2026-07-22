/// <reference types="w3c-web-usb" preserve="true" />
import { SuperbirdError, invalidOperation } from './errors.js';
import { SUPERBIRD_PARTITIONS } from './partitions.js';
import * as proto from './protocol.js';
import { hex, isAscii, resolveStream, retry, sleep, toBytes, withTimeout, } from './util.js';
export const DEFAULT_CONFIG = {
    stageChunkSize: proto.TRANSFER_SIZE_THRESHOLD,
    transferBlockSize: proto.TRANSFER_BLOCK_SIZE,
    bulkChunkSize: 'block',
    commandTimeoutMs: proto.COMMAND_TIMEOUT_MS,
    bulkTimeoutMs: proto.BULK_TIMEOUT_MS,
    writeRetries: 3,
    cooldownMs: 5000,
    slowCommandMs: 3000,
    resetDelayMs: 5000,
    reconnectTimeoutMs: 30_000,
};
const USB_FILTERS = [
    { vendorId: proto.VENDOR_ID, productId: proto.PRODUCT_ID },
    { vendorId: proto.VENDOR_ID_BOOTED, productId: proto.PRODUCT_ID_BOOTED },
];
const INTERFACE_NUMBER = 0;
class ProgressTracker {
    total;
    start = performance.now();
    written = 0;
    constructor(total) {
        this.total = total;
    }
    advance(bytes, chunkMs) {
        this.written += bytes;
        const elapsedMs = performance.now() - this.start;
        const avgBytesPerSec = elapsedMs > 0 ? this.written / (elapsedMs / 1000) : this.written;
        const remaining = this.total - this.written;
        return {
            percent: (this.written / this.total) * 100,
            bytesWritten: this.written,
            totalBytes: this.total,
            elapsedMs,
            etaMs: avgBytesPerSec > 0 ? (remaining / avgBytesPerSec) * 1000 : 0,
            rateKiBps: chunkMs > 0 ? bytes / (chunkMs / 1000) / 1024 : 0,
            avgRateKiBps: avgBytesPerSec / 1024,
        };
    }
}
export class Superbird {
    usb;
    config;
    endpointIn = 0;
    endpointOut = 0;
    opened = false;
    partitionTableLoaded = false;
    constructor(usb, config) {
        this.usb = usb;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    configure(overrides) {
        Object.assign(this.config, overrides);
        return this;
    }
    static modeOf(device) {
        if (device.vendorId === proto.VENDOR_ID_BOOTED && device.productId === proto.PRODUCT_ID_BOOTED) {
            return 'normal';
        }
        return device.productName === 'GX-CHIP' ? 'usb' : 'usb-burn';
    }
    static async getPairedDevices() {
        if (!('usb' in navigator))
            return [];
        const devices = await navigator.usb.getDevices();
        return devices.filter(d => USB_FILTERS.some(f => f.vendorId === d.vendorId && f.productId === d.productId));
    }
    static async connect(options = {}) {
        const onStatus = options.onStatus;
        let usb = options.device ?? (await Superbird.pickDevice());
        const mode = Superbird.modeOf(usb);
        if (mode === 'normal') {
            throw new SuperbirdError('wrong-mode', 'device is booted normally - power it on while holding buttons 1 & 4 to enter USB mode');
        }
        if (mode === 'usb') {
            if (!options.bl2 || !options.bootloader) {
                throw invalidOperation('device is in USB mode and needs a bl2 boot: pass `bl2` and `bootloader` binaries to connect()');
            }
            onStatus?.('connecting');
            const bird = new Superbird(usb, options.config);
            await bird.open();
            onStatus?.('bl2-boot');
            await bird.bl2Boot(options.bl2, options.bootloader);
            onStatus?.('resetting');
            await bird.close();
            await sleep(bird.config.resetDelayMs);
            onStatus?.('waiting-reconnect');
            usb = await Superbird.waitForBurnDevice(bird.config.reconnectTimeoutMs);
        }
        onStatus?.('connecting');
        const bird = new Superbird(usb, options.config);
        await retry(3, 1000, () => bird.open());
        onStatus?.('connected');
        return bird;
    }
    static async pickDevice() {
        if (!('usb' in navigator)) {
            throw new SuperbirdError('usb', 'WebUSB is not available in this browser');
        }
        try {
            return await navigator.usb.requestDevice({ filters: USB_FILTERS });
        }
        catch (error) {
            throw new SuperbirdError('not-found', 'no device selected', { cause: error });
        }
    }
    static async waitForBurnDevice(timeoutMs) {
        const deadline = performance.now() + timeoutMs;
        while (performance.now() < deadline) {
            const devices = await navigator.usb.getDevices();
            const found = devices.find(d => d.vendorId === proto.VENDOR_ID && d.productId === proto.PRODUCT_ID && d.productName !== 'GX-CHIP');
            if (found)
                return found;
            await sleep(500);
        }
        throw new SuperbirdError('not-found', 'device did not reappear in burn mode - it may need to be re-paired via requestDevice()');
    }
    get usbDevice() {
        return this.usb;
    }
    get mode() {
        return Superbird.modeOf(this.usb);
    }
    async open() {
        await this.usb.open();
        if (this.usb.configuration?.configurationValue !== 1) {
            await this.usb.selectConfiguration(1);
        }
        await this.usb.claimInterface(INTERFACE_NUMBER);
        const iface = this.usb.configuration?.interfaces.find(i => i.interfaceNumber === INTERFACE_NUMBER);
        const alternate = iface?.alternates[0];
        if (!alternate)
            throw invalidOperation('interface 0 has no alternate setting');
        let endpointIn;
        let endpointOut;
        for (const endpoint of alternate.endpoints) {
            if (endpoint.direction === 'in')
                endpointIn = endpoint.endpointNumber;
            else
                endpointOut = endpoint.endpointNumber;
        }
        if (endpointIn === undefined || endpointOut === undefined) {
            throw invalidOperation('bulk endpoints not found on interface 0');
        }
        this.endpointIn = endpointIn;
        this.endpointOut = endpointOut;
        this.opened = true;
    }
    async close() {
        this.opened = false;
        await this.usb.releaseInterface(INTERFACE_NUMBER).catch(() => { });
        await this.usb.close().catch(() => { });
    }
    ensureOpen() {
        if (!this.opened)
            throw invalidOperation('device is not open - use Superbird.connect()');
    }
    async controlOut(request, value, index, data) {
        this.ensureOpen();
        const result = await withTimeout(this.usb.controlTransferOut({ requestType: 'vendor', recipient: 'device', request, value, index }, data), this.config.commandTimeoutMs, `control transfer ${hex(request)}`);
        if (result.status !== 'ok') {
            throw new SuperbirdError('usb', `control transfer ${hex(request)} failed: ${result.status}`);
        }
    }
    async controlIn(request, value, index, length) {
        this.ensureOpen();
        const result = await withTimeout(this.usb.controlTransferIn({ requestType: 'vendor', recipient: 'device', request, value, index }, length), this.config.commandTimeoutMs, `control transfer ${hex(request)}`);
        if (result.status !== 'ok' || !result.data) {
            throw new SuperbirdError('usb', `control transfer ${hex(request)} failed: ${result.status}`);
        }
        return new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
    }
    async bulkOut(data, timeoutMs = this.config.bulkTimeoutMs) {
        this.ensureOpen();
        const result = await withTimeout(this.usb.transferOut(this.endpointOut, data), timeoutMs, 'bulk write');
        if (result.status !== 'ok') {
            throw new SuperbirdError('usb', `bulk write failed: ${result.status}`);
        }
        return result.bytesWritten;
    }
    async bulkIn(length, timeoutMs = this.config.commandTimeoutMs) {
        this.ensureOpen();
        const result = await withTimeout(this.usb.transferIn(this.endpointIn, length), timeoutMs, 'bulk read');
        if (result.status !== 'ok' || !result.data) {
            throw new SuperbirdError('usb', `bulk read failed: ${result.status}`);
        }
        return new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
    }
    async identify() {
        const data = await this.controlIn(proto.REQ_IDENTIFY_HOST, 0, 0, 8);
        if (data.length !== 8)
            throw invalidOperation('failed to read identify data');
        return new TextDecoder().decode(data);
    }
    async writeSimpleMemory(address, data) {
        if (data.length > 64)
            throw invalidOperation('maximum size of 64 bytes');
        await this.controlOut(proto.REQ_WRITE_MEM, address >>> 16, address & 0xffff, data);
    }
    async writeMemory(address, data) {
        let offset = 0;
        while (offset < data.length) {
            const chunk = Math.min(64, data.length - offset);
            await this.writeSimpleMemory(address + offset, data.subarray(offset, offset + chunk));
            offset += chunk;
        }
    }
    async readSimpleMemory(address, length) {
        if (length === 0)
            return new Uint8Array(0);
        if (length > 64)
            throw invalidOperation('maximum size of 64 bytes');
        const data = await this.controlIn(proto.REQ_READ_MEM, address >>> 16, address & 0xffff, length);
        if (data.length !== length)
            throw invalidOperation('incomplete read');
        return data;
    }
    async readMemory(address, length) {
        const out = new Uint8Array(length);
        let offset = 0;
        while (offset < length) {
            const chunk = Math.min(64, length - offset);
            out.set(await this.readSimpleMemory(address + offset, chunk), offset);
            offset += chunk;
        }
        return out;
    }
    async run(address, keepPower = true) {
        const target = keepPower ? (address | proto.FLAG_KEEP_POWER_ON) >>> 0 : address >>> 0;
        const buffer = new Uint8Array(4);
        new DataView(buffer.buffer).setUint32(0, target, true);
        await this.controlOut(proto.REQ_RUN_IN_ADDR, address >>> 16, address & 0xffff, buffer);
    }
    async bulkcmd(command) {
        const encoded = new TextEncoder().encode(`${command}\0`);
        await this.controlOut(proto.REQ_BULKCMD, 0, 0, encoded);
        const raw = await this.bulkIn(512);
        if (raw.length === 0) {
            throw new SuperbirdError('bulkcmd-failed', `no response received for bulk command: ${command}`);
        }
        let start = 0;
        let end = raw.length;
        while (start < end && raw[start] === 0)
            start++;
        while (end > start && raw[end - 1] === 0)
            end--;
        const response = new TextDecoder().decode(raw.subarray(start, end));
        if (!response.toLowerCase().includes('success')) {
            throw new SuperbirdError('bulkcmd-failed', `bulk command failed: ${command} -> ${response}`);
        }
        return response;
    }
    async writeLargeMemory(address, data, blockLength = this.config.transferBlockSize, appendZeros = true) {
        let payload = data;
        const remainder = data.length % blockLength;
        if (remainder !== 0) {
            if (!appendZeros)
                throw invalidOperation('data must be a multiple of block length');
            payload = new Uint8Array(data.length + (blockLength - remainder));
            payload.set(data);
        }
        const header = new Uint8Array(16);
        const view = new DataView(header.buffer);
        view.setUint32(0, address >>> 0, true);
        view.setUint32(4, payload.length, true);
        await this.controlOut(proto.REQ_WR_LARGE_MEM, blockLength, payload.length / blockLength, header);
        const { bulkChunkSize } = this.config;
        const chunkSize = bulkChunkSize === 'block'
            ? blockLength
            : Math.max(blockLength, Math.floor(bulkChunkSize / blockLength) * blockLength);
        let offset = 0;
        while (offset < payload.length) {
            const end = Math.min(offset + chunkSize, payload.length);
            await this.bulkOut(payload.subarray(offset, end));
            offset = end;
        }
    }
    async bl2Boot(bl2, bootloader) {
        const bl2Bytes = await toBytes(bl2);
        const bootloaderBytes = await toBytes(bootloader);
        await this.writeLargeMemory(proto.ADDR_BL2, bl2Bytes, 4096, true);
        await this.run(proto.ADDR_BL2, true);
        await sleep(2000);
        let prevLength = -1;
        let prevOffset = -1;
        let seq = 0;
        for (let iteration = 0; iteration < 50; iteration++) {
            const { length, offset } = await retry(3, 500, () => this.getBootAmlc());
            if (length === prevLength && offset === prevOffset)
                return;
            prevLength = length;
            prevOffset = offset;
            if (offset >= bootloaderBytes.length) {
                await this.writeAmlcDataPacket(seq, offset, new Uint8Array(0));
            }
            else {
                const actualLength = Math.min(length, bootloaderBytes.length - offset);
                await this.writeAmlcDataPacket(seq, offset, bootloaderBytes.subarray(offset, offset + actualLength));
            }
            seq = (seq + 1) & 0xff;
            await sleep(100);
        }
        throw invalidOperation('maximum iterations reached in bl2Boot');
    }
    async getBootAmlc() {
        await this.controlOut(proto.REQ_GET_AMLC, proto.AMLC_AMLS_BLOCK_LENGTH, 0);
        const buf = await this.bulkIn(proto.AMLC_AMLS_BLOCK_LENGTH, 2000);
        if (buf.length < proto.AMLC_AMLS_BLOCK_LENGTH)
            throw invalidOperation('no amlc data received');
        const tag = new TextDecoder().decode(buf.subarray(0, 4));
        if (tag !== 'AMLC')
            throw invalidOperation(`invalid amlc request: ${tag}`);
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const length = view.getUint32(8, true);
        const offset = view.getUint32(12, true);
        const ack = new Uint8Array(16);
        ack.set(new TextEncoder().encode('OKAY'));
        await this.bulkOut(ack);
        return { length, offset };
    }
    async writeAmlcData(offset, data) {
        await this.controlOut(proto.REQ_WRITE_AMLC, Math.floor(offset / proto.AMLC_AMLS_BLOCK_LENGTH), data.length - 1);
        let dataOffset = 0;
        let remaining = data.length;
        while (remaining > 0) {
            const blockLength = Math.min(remaining, proto.AMLC_MAX_BLOCK_LENGTH);
            const chunk = data.subarray(dataOffset, dataOffset + blockLength);
            await retry(3, 100, async () => {
                const written = await this.bulkOut(chunk, 1000);
                if (written !== blockLength)
                    throw new SuperbirdError('usb', `incomplete bulk write: ${written}/${blockLength}`);
            });
            dataOffset += blockLength;
            remaining -= blockLength;
            await sleep(10);
        }
        const ackBuf = await retry(3, 100, async () => {
            const buf = await this.bulkIn(16, 1000);
            if (buf.length < 4)
                throw invalidOperation(`short ack read: ${buf.length} bytes`);
            return buf;
        });
        const ack = new TextDecoder().decode(ackBuf.subarray(0, 4));
        if (ack !== 'OKAY')
            throw invalidOperation(`invalid amlc data write ack: ${ack}`);
    }
    async writeAmlcDataPacket(seq, amlcOffset, data) {
        let offset = 0;
        while (offset < data.length) {
            const writeLength = Math.min(proto.AMLC_MAX_TRANSFER_LENGTH, data.length - offset);
            await this.writeAmlcData(offset, data.subarray(offset, offset + writeLength));
            await sleep(50);
            offset += writeLength;
        }
        const checksum = amlcChecksum(data);
        const block = new Uint8Array(proto.AMLC_AMLS_BLOCK_LENGTH);
        block.set(new TextEncoder().encode('AMLS'));
        block[4] = seq;
        new DataView(block.buffer).setUint32(8, checksum, true);
        if (data.length > 16) {
            const copyLength = Math.min(proto.AMLC_AMLS_BLOCK_LENGTH - 16, data.length - 16);
            block.set(data.subarray(16, 16 + copyLength), 16);
        }
        await this.writeAmlcData(amlcOffset, block);
    }
    async ensurePartitionTable() {
        if (this.partitionTableLoaded)
            return;
        await this.bulkcmd('amlmmc part 1');
        this.partitionTableLoaded = true;
    }
    async validatePartitionSize(name) {
        const info = SUPERBIRD_PARTITIONS[name];
        if (name === 'cache')
            throw invalidOperation('the "cache" partition is zero-length and cannot be accessed');
        if (name === 'reserved')
            throw invalidOperation('the "reserved" partition cannot be read or written');
        await this.ensurePartitionTable();
        const tryRead = (size) => this.bulkcmd(`amlmmc read ${name} ${hex(proto.ADDR_TMP)} ${hex(size - proto.PART_SECTOR_SIZE)} ${hex(proto.PART_SECTOR_SIZE)}`);
        const partSize = info.size * proto.PART_SECTOR_SIZE;
        try {
            await tryRead(partSize);
            return partSize;
        }
        catch (error) {
            if (info.sizeAlt === undefined)
                throw error;
            const altSize = info.sizeAlt * proto.PART_SECTOR_SIZE;
            await tryRead(altSize);
            return altSize;
        }
    }
    async restorePartition(name, data, options = {}) {
        const partSize = await this.validatePartitionSize(name);
        const { reader, size } = await resolveStream(data);
        const effectivePartSize = name === 'bootloader' ? 2 * 1024 * 1024 : partSize;
        if (size > effectivePartSize && name !== 'bootloader') {
            await reader.cancel();
            throw invalidOperation(`file is larger than target partition: ${size} bytes vs ${effectivePartSize} bytes`);
        }
        await this.bulkcmd('amlmmc key');
        await this.stagedWrite(reader, size, (offset, length) => `amlmmc write ${name} ${hex(proto.ADDR_TMP)} ${hex(offset)} ${hex(length)}`, options, name === 'bootloader');
    }
    async writeUserArea(lba, data, options = {}) {
        const { reader, size } = await resolveStream(data);
        await this.bulkcmd('mmc dev 1 0');
        await this.bulkcmd('amlmmc key');
        await this.stagedWrite(reader, size, (offset, length) => {
            const chunkLba = lba + Math.floor(offset / proto.PART_SECTOR_SIZE);
            const sectors = Math.ceil(length / proto.PART_SECTOR_SIZE);
            return `mmc write ${hex(proto.ADDR_TMP)} ${hex(chunkLba)} ${hex(sectors)}`;
        }, options);
    }
    async writeBootPartition(hwpart, data) {
        const bytes = await toBytes(data);
        if (bytes.length > this.config.stageChunkSize) {
            throw invalidOperation(`boot partition payload ${bytes.length} bytes exceeds single-transfer cap ${this.config.stageChunkSize}`);
        }
        await this.bulkcmd(`mmc dev 1 ${hwpart}`);
        await this.bulkcmd('amlmmc key');
        await this.writeLargeMemory(proto.ADDR_TMP, bytes);
        const sectors = Math.ceil(bytes.length / proto.PART_SECTOR_SIZE);
        await this.bulkcmd(`mmc write ${hex(proto.ADDR_TMP)} 0 ${hex(sectors)}`);
        await this.bulkcmd('mmc dev 1 0');
    }
    async writeEnv(env, options = {}) {
        if (!isAscii(env))
            throw invalidOperation('env data must be ascii');
        const bytes = new TextEncoder().encode(env);
        await this.bulkcmd('amlmmc env');
        await this.writeLargeMemory(proto.ADDR_TMP, bytes);
        await this.bulkcmd(`env import -t ${hex(proto.ADDR_TMP)} ${hex(bytes.length)}`);
        if (options.save)
            await this.bulkcmd('saveenv');
    }
    async stagedWrite(reader, totalBytes, makeCommand, options, expectTimeout = false) {
        const tracker = new ProgressTracker(totalBytes);
        let offset = 0;
        try {
            while (offset < totalBytes) {
                options.signal?.throwIfAborted();
                const chunkStart = performance.now();
                const length = Math.min(totalBytes - offset, this.config.stageChunkSize);
                const chunk = await reader.readExact(length);
                await this.writeLargeMemory(proto.ADDR_TMP, chunk, options.blockLength ?? this.config.transferBlockSize);
                if (expectTimeout) {
                    await this.bulkcmd(makeCommand(offset, length)).catch(() => { });
                    await sleep(2000);
                }
                else {
                    const commandStart = performance.now();
                    await retry(this.config.writeRetries, this.config.cooldownMs, () => this.bulkcmd(makeCommand(offset, length)));
                    if (performance.now() - commandStart > this.config.slowCommandMs)
                        await sleep(this.config.cooldownMs);
                }
                offset += length;
                options.onProgress?.(tracker.advance(length, performance.now() - chunkStart));
            }
        }
        finally {
            await reader.cancel();
        }
    }
}
function amlcChecksum(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let checksum = 0;
    let offset = 0;
    while (offset < data.length) {
        const remaining = data.length - offset;
        let value;
        if (remaining >= 4) {
            value = view.getUint32(offset, true);
            offset += 4;
        }
        else if (remaining === 3) {
            value = (view.getUint16(offset, true) | (view.getUint8(offset + 2) << 16)) >>> 0;
            offset += 3;
        }
        else if (remaining === 2) {
            value = view.getUint16(offset, true);
            offset += 2;
        }
        else {
            value = view.getUint8(offset);
            offset += 1;
        }
        checksum = (checksum + value) % 4294967296;
    }
    return checksum;
}
//# sourceMappingURL=superbird.js.map