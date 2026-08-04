# Micromouse Firmware

This repository contains firmware for a STM32F411-based Micromouse project. The code implements a maze-solving controller that builds a map of the maze, updates wall information, computes path costs, and issues motion commands to guide the robot from a start position to a goal.

## What this project does

The firmware is organized around a maze-exploration and path-planning loop:

- Initializes the STM32 microcontroller peripherals and FreeRTOS tasks.
- Maintains a maze representation using a grid of cells and wall states.
- Updates the maze based on wall detections from sensors or from the built-in simulator.
- Uses a flood-fill / cost propagation method to compute the lowest-cost path to the target.
- Chooses the next cell and translates that decision into movement commands for the motors.

In short, this project is intended to make a small autonomous robot solve a maze.

## Project overview

This repository mixes CubeMX-generated STM32 support files with custom firmware logic:

- [Core/Src/main.c](Core/Src/main.c) – application entry point and peripheral initialization.
- [Core/Src/freertos.c](Core/Src/freertos.c) – FreeRTOS task setup and task entry points.
- [Core/Src/maze_main.c](Core/Src/maze_main.c) – main maze-solving loop.
- [Core/Src/maze.c](Core/Src/maze.c) – maze representation and wall updates.
- [Core/Src/costAlgorithm.c](Core/Src/costAlgorithm.c) – cost propagation and path selection.
- [Core/Src/Locomotion.c](Core/Src/Locomotion.c) – movement and navigation commands.
- [Core/Src/simulator.c](Core/Src/simulator.c) – simulation mode for testing the solver without real sensors.

## Hardware target

This firmware is built for an STM32F411-based board with the following characteristics:

- MCU: STM32F411RET6
- Build system: CMake + Ninja
- RTOS: FreeRTOS
- Interfaces: GPIO, timers, UART, USB, SPI/I2C peripherals

## Software requirements

Before building the project, install the following:

- ARM GNU Toolchain for Cortex-M (`arm-none-eabi-gcc`, `arm-none-eabi-g++`, `arm-none-eabi-objcopy`, `arm-none-eabi-gdb`)
- CMake 3.22 or newer
- Ninja
- Git
- Optional but recommended: STM32CubeProgrammer or a VS Code debug/flash setup with ST-Link support

On Windows, the toolchain must be available in your PATH.

## Build instructions

From the repository root, configure and build the project with the provided presets:

```powershell
cmake --preset Debug
cmake --build --preset Debug
```

This uses the preset configuration in [CMakePresets.json](CMakePresets.json) and the toolchain file in [cmake/gcc-arm-none-eabi.cmake](cmake/gcc-arm-none-eabi.cmake).

If configuration fails with a message like `arm-none-eabi-gcc not found`, install the ARM toolchain and make sure it is on your PATH.

## Flashing to the board

After a successful build, flash the generated firmware image to the STM32 board.

### Option 1: STM32CubeProgrammer

If you have STM32CubeProgrammer installed, you can flash the ELF file with a command similar to:

```powershell
STM32_Programmer_CLI -c port=SWD -w .\build\Debug\Rat_Rocket_F411RET6_PinConfigs.elf -v -rst
```

The exact output path may vary slightly depending on your CMake generator and environment.

### Option 2: VS Code + ST-Link

You can also use VS Code with CMake Tools and a Cortex-M debug extension, then flash and run from the editor.

## Running the firmware

Once the firmware is flashed:

1. Power the robot board.
2. Connect any required serial/USB interface for debug output.
3. Observe the robot behavior as it executes the maze-solving loop.

## UART communication details

The firmware uses UART for host communication and telemetry on USART1.

### UART configuration

- Port: USART1
- Baud rate: 115200 bps
- Data bits: 8
- Parity: none
- Stop bits: 1
- Flow control: none

This is configured in [Core/Src/usart.c](Core/Src/usart.c) and the message transport is handled in [Core/Src/comm_uart.c](Core/Src/comm_uart.c).

### What it accepts from the host

The receiver listens for incoming UART bytes and, when a frame is received, places the received data into the maze queue for processing.

The maze-solving logic expects an ASCII frame made of 11 characters, where each character is a digit or wall flag:

- bytes 0-3: start and goal coordinates, such as start X/Y and end X/Y
- byte 4: current absolute direction
- bytes 5-6: current cell position X/Y
- bytes 7-10: wall flags for north, south, west, and east as ASCII `1` or `0`

In practice, the firmware parses the incoming data as ASCII digits and uses the values to update the current maze state. The implementation in [Core/Src/maze_main.c](Core/Src/maze_main.c) shows that it expects the data to be a compact character array rather than a structured binary packet.

### What it sends back

The firmware sends UART telemetry back over the same USART1 link using the `[TMSG] ...` format.

Typical outgoing messages include:

- `FORWARD`
- `REVERSE`
- `LEFT`
- `RIGHT`
- `UTURN`
- `NONE`
- `G` when the target is reached

These messages are emitted through the debug logging layer in [Core/Inc/debug_log.h](Core/Inc/debug_log.h) and are used for basic runtime telemetry.

## Simulation mode

The solver can run in simulation mode by default. This is controlled in [Core/Inc/maze_main.h](Core/Inc/maze_main.h) and [Core/Src/maze_main.c](Core/Src/maze_main.c).

The current project is set up so the solver uses the built-in simulation path unless the code is changed to use real wall-sensor input. This is convenient for testing and debugging the maze-solving logic without hardware.

## Real hardware notes

The current code contains calls to wall-detection functions such as `API_leftWall()`, `API_frontWall()`, and `API_rightWall()`. In the current implementation, these functions read values from the terminal input rather than actual hardware sensors. That means:

- Simulation mode is the easiest way to validate the planning logic.
- Real hardware integration will require replacing these functions with sensor reads from the actual robot hardware.

## Repository structure

```text
.
├── CMakeLists.txt
├── CMakePresets.json
├── Core/
│   ├── Inc/
│   └── Src/
├── Drivers/
├── Middlewares/
├── USB_DEVICE/
└── build/
```

## Typical development workflow

1. Edit the firmware sources in [Core/Src](Core/Src) and [Core/Inc](Core/Inc).
2. Rebuild with:
   ```powershell
   cmake --preset Debug
   cmake --build --preset Debug
   ```
3. Flash the generated binary to the board.
4. Test the robot behavior and adjust the maze logic or motor control as needed.

## Summary

This repository is a firmware project for an STM32-based Micromouse that:

- maps the maze,
- tracks walls,
- computes a path using cost propagation,
- and drives the robot toward a target cell.

It is a solid starting point for a custom autonomous maze-solving robot and can be extended with real sensor input, improved motion control, and more advanced maze-solving behavior.
