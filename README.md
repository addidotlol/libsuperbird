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

## Browser support

WebUSB needs a Chromium browser on a secure context (https or localhost). On Linux you also need a udev rule:

```
SUBSYSTEM=="usb", ATTRS{idVendor}=="1b8e", ATTRS{idProduct}=="c003", MODE="0666"
```
