# RatRocket UF2 bootloader

Prebuilt bootloader: `tinyuf2-kavwv-ratrocket.bin` (15,808 bytes, flashed at
0x08000000 over ST-Link). Board definition for rebuilding it from
https://github.com/adafruit/tinyuf2 is in `kavwv_ratrocket/` (copy that folder
to `ports/stm32f4/boards/` in a tinyuf2 checkout; build notes and the exact
commands are in docs/firmware.md).

Flash map it assumes: 0x08000000 bootloader (sectors 0-1 write-protected),
0x08010000 application (built by this repo, linked there), 0x08060000 settings.
ST-Link recovery including the write-protection override is documented in
docs/firmware.md.
