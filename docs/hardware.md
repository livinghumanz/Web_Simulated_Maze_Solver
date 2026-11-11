# RatRocket hardware notes

Quick reference distilled from the schematics in [schematics/](schematics/)
plus what was measured on the real board. Schematic = what the PDF says;
**measured** = verified on hardware.

## Main board (Revenge of Rat Rocket PCB Rev 1, 25 MHz HSE)

MCU: the schematic says STM32F411**RC**T6 (256 KB flash), but the fitted chip
reports **512 KB** (flash-size register 0x1FFF7A22 = 0x0200), i.e. an F411**RE**,
matching the CubeMX project. The first 64 KB hold the USB bootloader, the last
128 KB sector the saved settings (flash map in [firmware.md](firmware.md#flash-map)).

### Motors and driver (DRV8833 module, U8)

| Signal | MCU pin | Timer | DRV8833 module pin | Motor |
|---|---|---|---|---|
| MCU_Motor_1A | PA6 (22) | TIM3_CH1 | IN1 (7) | Right wheel (schematic M2, Motor_1A/1B) |
| MCU_Motor_1B | PA7 (23) | TIM3_CH2 | IN2 (8) | Right |
| MCU_Motor_2A | PB0 (26) | TIM3_CH3 | IN4 (12) | Left wheel (schematic M1, Motor_2A/2B) |
| MCU_Motor_2B | PB1 (27) | TIM3_CH4 | IN3 (11) | Left |
| Motor_Error_Pin | PC13 (2) | – | ULT = nFAULT (10 k pull-up to IO_VCC) | low = driver fault |
| Driver_Enable | via jumper JP4: MCU_GPIO_1 (PB4) or ESP_GPIO_2 | – | EEP = nSLEEP | |

- CubeMX labels PB0 "Motor_2B" and PB1 "Motor_2A" — swapped relative to the
  schematic net names. Firmware uses the pins, so this is cosmetic.
- DRV8833 truth table: IN_x = IN_y = 1 → brake, both 0 → coast.
- **Measured fault (2026-11-06):** PB1 toggles correctly at the MCU pin (read
  back via GPIOB IDR), but the left motor never sees it: it cannot reverse, and
  "brake" drives it forward. Suspect the PB1 → module IN3 link (MCU pin 27
  joint, trace, or the module header pin). Right motor brakes/reverses fine.
- **Repaired 2026-11-07:** PB1 → IN3 re-soldered. The first attempt shorted
  the driver supply (board heated on USB-C only; D6 was lifted to isolate it,
  then the short was removed and D6 refitted). Verified: `DECEL L` reverse
  stops the left wheel in 24 counts / 17 ms. SWEEP after the repair: the left
  needs ~110 more duty than the right at low/medium speed (duty 400: L 820 /
  R 1674 counts/s, equal near full duty) → `MOTION_KSTATIC_LEFT_EXTRA`.
  `FAULT` (PC13) reads 0 even while both bridges drive - not meaningful.
- If the driver ever shorts again: `MOTOR_OUTPUTS_ENABLED 0` in `motor.h` puts
  the four driver inputs in analog mode, and lifting D6 cuts the driver off
  the 5 V side; the push game (`PUSH`) then still works.
- Driver VCC = Battery_VCC through D6 (1N4007, bypass jumper JP6).

### Encoders (N20 motors with magnetic encoders)

| Wheel | A / B pins | Timer | Notes |
|---|---|---|---|
| Right (Motor1_Encoder) | PA15 / PB3 | TIM2 | counts down when driving forward → sign flipped in firmware |
| Left (Motor2_Encoder) | PB6 / PB7 | TIM4 | |

**Measured:** first estimate by eye-counting wheel turns gave ≈2503/2517
counts per turn (≈23.5 counts/mm) - too low. The floor-ruler calibration of
2026-11-06 (`CALDIST`, drive 300 mm and measure) settled on **2874 counts per
wheel turn → ≈26.9 counts per mm** (wheel Ø34 mm); that value is what the
firmware uses (`ENC_CPR` in motion.h). A nice classroom research question:
measure it yourself and see which method you trust.

### Power

- Battery connector RMC1: 2S Li-ion (8.4 V full), power toggle S1 → Battery_VCC.
- Battery_VCC → two AMS1117-5.0 (+5V_1, +5V_2) → two AMS1117-3.3 (IO_VCC, +3.3V).
- USB-C VBUS → 1N4007 diodes D4/D5 (bypass jumpers JP7/JP8) → +5V_1/+5V_2.
  On USB only, Battery_VCC (and so the motor driver) is only back-fed through
  the 5 V regulators, so the motors get roughly 3–4 V and are weak. Use the
  battery for anything beyond bench tests.
- Battery sense: Battery_VCC → R14 47 k / R15 **18 k** (schematic) → PA0.
  The vendor code (and `battery.c`) assumes 47 k / **22 k**. Unresolved: check
  the fitted resistor or compare against a multimeter on battery power.

### DIP switch S2 (4-way), buttons, LEDs

- Each Select_Switch line: 10 k in series from 3.3 V through the switch, plus a
  100 k pull-down to GND (R1–R4). ON = high. No internal pull is needed (an
  internal pull-down would lower the ON level to ≈2.4 V, too close to VIH).
- **Measured:** the switch the user calls "SW1" is wired to PC3
  (Select_Switch_4), i.e. the order is reversed relative to the CubeMX labels.
  Only 3 of the 4 switches work (user); modes use SW1–SW3.
- Buttons: NRST (reset); MCU_Boot_1 = BOOT0 (do not use); **MCU_Boot_2 = PB2
  push-button, 10 k pull-down, active high** — usable as a "start" button.
- RGB LED (LED1 + U9): RGB_Red PC8, RGB_Green PC9, RGB_Blue PB5, active high
  (anodes through 470 Ω to the pins, common cathode to GND). The USB
  bootloader uses blue.

### Flashing over USB-C

- Works since 2026-11-10 with the **tinyuf2** bootloader in the first 64 KB of
  flash: `UPDATE` or a double-press of reset shows a USB drive named RATROCKET,
  and copying a `.uf2` file onto it flashes the robot. See
  [firmware.md](firmware.md#flashing). The ST-Link (a 20–30 cm SWD cable is
  fine) remains the recovery path.
- ST's ROM bootloader is still unusable, so do not use BOOT0: USB DFU on
  PA11/PA12 only runs while BOOT0 is held (the chip's bootloader resets itself,
  RCC_CSR software reset, when BOOT0 is low), and its USB enumeration then
  fails ("Device Descriptor Request Failed", VID 0000 PID 0002) - the known
  STM32F411 + 25 MHz HSE bootloader issue. Not fixed by replugging.
- tinyuf2 had to use the application's clock tree (25 MHz / 15 × 144 / 6 =
  40 MHz core, / 5 = 48 MHz USB). With tinyuf2's usual F411 setting (1 MHz PLL
  input, 84 MHz, voltage scale 2, 2 wait states) it crashed at random during
  start-up (corrupted instruction fetches) in 2 of its 3 starts; with the
  slower clock none of 40+ starts failed.
- **Measured 2026-11-10:** VDDA = 3.29 V on USB power (internal VREFINT via
  SWD). The ST-Link's "target voltage" reading of 2.30 V is wrong for this
  probe.

### Connectors

| Header | Contents |
|---|---|
| H1 (BT, 1x6) | +5V_2, GND, BT_TX → UART_6_RX (PC7), BT_RX → UART_6_TX (PC6). KEY/STATE not wired, so AT mode needs the button on the HC-05. |
| H4 (ESP-01, 2x4) | Shares UART6 with the BT module — fit only one of them. |
| H2 (IMU, 1x10) | PC10 SCK/SCL, PC12 MOSI/SDA, PC11 MISO, PD2 CS, PC4 INT, PC5 FSYNC. Vendor code uses software I2C on PC10/PC12 for the MPU6050. |

**IMU bring-up (2026-11-11):** an MPU6050 module on H2 answers at 0x68
(WHO_AM_I 0x68) over the vendor's software I2C (`sw_i2c.c`, `mpu6050_sw.c`,
probe in `imu.c`, console command `IMU`). First readings at rest: acc Z
~14200-14300 (nominal 16384 for 1 g: slight tilt or scale offset), gyro
zero-rate offsets about -560 / -1150 / -240 raw (= -4 / -9 / -2 deg/s) -
large but typical for clones; a bias calibration at rest is needed before
the gyro steers turns. The first sample after wake-up reads all zeros.
| H3 (interface board, 2 mm 1x10) | +5V_2, GND, S1 = PB8 (I2C1 SCL), S2 = PB9 (I2C1 SDA), A0–A4 = PA1–PA5, G1 = PB10 |
| J1 | SWD (SWDIO PA13, SWCLK PA14) |
| J2 | UART1 (PA9 TX, PA10 RX) — FTDI on COM7 |
| USB1 | USB-C, CC 5.1 k pull-downs, D+/D− on PA12/PA11 |

## Interface (wall-sensor) boards — plug into H3

| Board | Sensors | Pin use |
|---|---|---|
| Module 1-2 (ToF) | up to 5× VL53L0X on I2C1 (10 k pull-ups), 1× HC-SR04 | ToF mode: A0 Left XSHUT, A1 Right XSHUT, A2 Front INT, A3 Left INT, A4 Right INT, G1 Front XSHUT. HC-SR04 TRIG = G1, ECHO = A0. JP1 picks 5 V or 3.3 V sensor supply. |
| Module 3-4 page 1 (ultrasonic) | 3× HC-SR04 + 1× VL53L0X | US1 TRIG G1 / ECHO A0, US2 TRIG A3 / ECHO A1, US3 TRIG A4 / ECHO A2 |
| Module 3-4 page 2 (IR) | 5 IR receivers, emitters always on (no MCU control) | A0 Front, A1 Front-left, A2 Front-right, A3 Left, A4 Right |

**Measured (ultrasonic board on the front panel, 2026-11-06):** US1 = front,
US2 = left, US3 = right (firmware default mapping). Centred between two walls
in a ~14 cm corridor each side sensor reads ≈ 37–42 mm. This HC-SR04 batch
reports distance in ≈ 9 mm steps.

⚠ The IR receivers have 10 k pull-ups to **+5 V**, so a dark sensor drives
A0–A4 to ≈5 V. PA1–PA5 are not 5 V tolerant in analog mode (max VDDA ≈ 3.3 V).
Check this before using the IR board with the ADC.
