# libsuperbird

WebUSB library for flashing the Spotify Car Thing (Superbird). Runs entirely in the browser.

>[!NOTE]
This doesn't work on Firefox or Safari based browsers due to the lack of WebUSB. Use a good browser.

```sh
npm install libsuperbird
```

## Usage

```ts
import { Superbird } from 'libsuperbird';

const thing = await Superbird.connect({
  bl2: await fetch('/superbird.bl2.encrypted.bin').then(r => r.blob()),
  bootloader: await fetch('/superbird.bootloader.img').then(r => r.blob()),
  onStatus: status => console.log(status),
});

await thing.restorePartition('boot_a', bootImageBlob, {
  onProgress: p => console.log(`${p.percent.toFixed(1)}%`),
});
```

- Calling `connect()` must be in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) and must be done via a click handler.

## Sparse flashing

Filesystem images are mostly zeros, and normally every zero byte crosses USB and gets written. Passing `sparse: true` skips zero regions instead, which can roughly halve flash times. The target has to be erased first so skipped regions actually read as zeros. Calling `restorePartition` will do this for you. If you use `writeUserArea` call `erase()` yourself:

```ts
await thing.restorePartition('system_a', image, { sparse: true });

await thing.erase(0, Math.ceil(image.size / 512));
await thing.writeUserArea(0, image, { sparse: true });
```

`libsuperbird` will verify the sector is erased before Sparse flashing. If not erased, it will fall back to a full write. 

## Browser support

WebUSB needs a Chromium browser on a secure context (https or localhost). On Linux you also need a udev rule:

```
SUBSYSTEM=="usb", ATTRS{idVendor}=="1b8e", ATTRS{idProduct}=="c003", MODE="0666"
```
