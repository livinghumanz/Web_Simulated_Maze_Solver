#!/usr/bin/env python3
"""Convert a raw firmware image (.bin) into a UF2 file for the RatRocket.

The robot runs the tinyuf2 USB bootloader in the first 64 KB of flash. In
update mode it shows up as a USB drive named RATROCKET; copying a .uf2 file
onto that drive flashes the application and restarts the robot.

Usage (the CMake build runs this after every link, see CMakeLists.txt):

    arm-none-eabi-objcopy -O binary firmware.elf firmware.bin
    python tools/make_uf2.py firmware.bin ratrocket.uf2

UF2 format (https://github.com/microsoft/uf2, README "File format"): the file
is a sequence of independent 512-byte blocks, each carrying up to 476 bytes
of data for one flash address. All fields are little-endian uint32:

    offset  size  field
         0     4  magicStart0   0x0A324655 ("UF2\\n")
         4     4  magicStart1   0x9E5D5157
         8     4  flags         0x00002000 = familyID field is valid
        12     4  targetAddr    flash address of this block's payload
        16     4  payloadSize   bytes used in data[]  (always 256 here)
        20     4  blockNo       0 .. numBlocks-1
        24     4  numBlocks     total blocks in the file
        28     4  familyID      0x57755A57 = STM32F4
        32   476  data          payload, rest zero-padded
       508     4  magicEnd      0x0AB16F30

tinyuf2 only flashes blocks whose familyID matches its own, and it resets
into the new firmware once it has received numBlocks distinct blocks.

Safety checks, so a bad file is caught here and never reaches the robot:
- the image must fit between --base and --limit. On the RatRocket the limit
  is 0x08060000, the start of flash sector 7 with the saved settings: the
  bootloader erases every sector a block lands in, so a block past the limit
  would wipe the settings. (tinyuf2 itself does not check the address.)
- the image must start with a vector table linked for --base: an initial
  stack pointer in SRAM (the same test the bootloader applies) and a reset
  handler inside the image. This catches a program still linked for
  0x08000000, which the bootloader would refuse to start.
"""

import argparse
import struct
import sys

UF2_MAGIC_START0 = 0x0A324655
UF2_MAGIC_START1 = 0x9E5D5157
UF2_MAGIC_END = 0x0AB16F30
UF2_FLAG_FAMILY_ID_PRESENT = 0x00002000

UF2_BLOCK_SIZE = 512
UF2_DATA_SIZE = 476      # data[] field in every block
PAYLOAD_SIZE = 256       # bytes of firmware per block (the usual choice)

FAMILY_STM32F4 = 0x57755A57

# RatRocket flash map (docs/firmware.md)
APP_BASE = 0x08010000    # after the 64 KB bootloader
APP_LIMIT = 0x08060000   # sector 7 (saved settings) starts here


def check_vector_table(image, base):
    """Return an error message if the image does not start like a program
    linked to run at `base`, else None."""
    if len(image) < 8:
        return "image is shorter than a vector table"
    initial_sp, reset_handler = struct.unpack_from("<II", image, 0)
    # Same rule as tinyuf2's board_app_valid(): word-aligned, in 0x20xxxxxx.
    if (initial_sp & 0xFF000003) != 0x20000000:
        return "first word 0x%08X is not an SRAM stack pointer" % initial_sp
    entry = reset_handler & ~1   # bit 0 is the Thumb bit
    if not base <= entry < base + len(image):
        return ("reset handler 0x%08X is outside the image 0x%08X-0x%08X; "
                "is the program linked for 0x%08X?"
                % (reset_handler, base, base + len(image), base))
    return None


def make_uf2(image, base, family_id):
    """Split `image` into UF2 blocks starting at flash address `base`."""
    num_blocks = (len(image) + PAYLOAD_SIZE - 1) // PAYLOAD_SIZE
    blocks = []
    for block_no in range(num_blocks):
        offset = block_no * PAYLOAD_SIZE
        payload = image[offset:offset + PAYLOAD_SIZE]
        # Pad the last block with 0xFF, the value of erased flash, so the
        # bytes after the image are left blank.
        payload = payload.ljust(PAYLOAD_SIZE, b"\xff")
        header = struct.pack(
            "<8I",
            UF2_MAGIC_START0,
            UF2_MAGIC_START1,
            UF2_FLAG_FAMILY_ID_PRESENT,
            base + offset,          # targetAddr
            PAYLOAD_SIZE,           # payloadSize
            block_no,
            num_blocks,
            family_id,
        )
        data = payload.ljust(UF2_DATA_SIZE, b"\x00")
        block = header + data + struct.pack("<I", UF2_MAGIC_END)
        assert len(block) == UF2_BLOCK_SIZE
        blocks.append(block)
    return b"".join(blocks)


def parse_int(text):
    """Accept decimal or 0x-prefixed hex on the command line."""
    return int(text, 0)


def main():
    parser = argparse.ArgumentParser(
        description="Convert a .bin firmware image into a UF2 file for the "
                    "RatRocket's tinyuf2 bootloader.")
    parser.add_argument("input", help="raw image from objcopy -O binary")
    parser.add_argument("output", help="UF2 file to write")
    parser.add_argument("--base", type=parse_int, default=APP_BASE,
                        help="flash address of the image's first byte "
                             "(default 0x%08X)" % APP_BASE)
    parser.add_argument("--limit", type=parse_int, default=APP_LIMIT,
                        help="first flash address the image must not reach "
                             "(default 0x%08X, the settings sector)" % APP_LIMIT)
    parser.add_argument("--family", type=parse_int, default=FAMILY_STM32F4,
                        help="UF2 family ID (default 0x%08X = STM32F4)"
                             % FAMILY_STM32F4)
    args = parser.parse_args()

    with open(args.input, "rb") as f:
        image = f.read()

    if not image:
        sys.exit("make_uf2: %s is empty" % args.input)
    if args.base % PAYLOAD_SIZE:
        sys.exit("make_uf2: base 0x%08X is not a multiple of %d"
                 % (args.base, PAYLOAD_SIZE))
    end = args.base + len(image)
    if end > args.limit:
        sys.exit("make_uf2: image 0x%08X-0x%08X runs past the limit 0x%08X "
                 "(%d bytes too big)" % (args.base, end, args.limit,
                                          end - args.limit))
    problem = check_vector_table(image, args.base)
    if problem:
        sys.exit("make_uf2: %s: %s" % (args.input, problem))

    uf2 = make_uf2(image, args.base, args.family)
    with open(args.output, "wb") as f:
        f.write(uf2)

    print("make_uf2: %s -> %s: %d bytes at 0x%08X-0x%08X, %d blocks, "
          "family 0x%08X"
          % (args.input, args.output, len(image), args.base, end,
             len(uf2) // UF2_BLOCK_SIZE, args.family))


if __name__ == "__main__":
    main()
