cmake_minimum_required(VERSION 3.22)

#
# This file is generated only once,
# and is not re-generated if converter is called multiple times.
#
# User is free to modify the file as much as necessary
#

# Setup compiler settings
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)


# Define the build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE "Debug")
endif()

# Set the project name
set(CMAKE_PROJECT_NAME Rat_Rocket_F411RET6_PinConfigs)

# Enable compile command to ease indexing with e.g. clangd
set(CMAKE_EXPORT_COMPILE_COMMANDS TRUE)

# Core project settings
project(${CMAKE_PROJECT_NAME})
message("Build type: " ${CMAKE_BUILD_TYPE})

# Enable CMake support for ASM and C languages
enable_language(C ASM)

# Create an executable object type
add_executable(${CMAKE_PROJECT_NAME})

# Add STM32CubeMX generated sources
add_subdirectory(cmake/stm32cubemx)

# Link directories setup
target_link_directories(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user defined library search paths
)

# Add sources to executable
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user sources here
    Core/Src/maze_main.c
    Core/Src/maze_queue.c
    Core/Src/Locomotion.c
    Core/Src/costAlgorithm.c
    Core/Src/maze.c
    Core/Src/motor.c
    Core/Src/simulator.c
    Core/Src/comm_uart.c
    Core/Src/bt_log.c
    Core/Src/dip_switch.c
    Core/Src/app_bt_test.c
    Core/Src/app_motor_test.c
    Core/Src/encoder.c
    Core/Src/battery.c
    Core/Src/motion.c
    Core/Src/app_pid_test.c
    Core/Src/ultrasonic.c
    Core/Src/maze_run.c
    Core/Src/app_maze.c
    Core/Src/settings.c
    Core/Src/dfu.c
)

# Add include paths
target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user defined include paths
    Core/Inc/
)

# Add project symbols (macros)
target_compile_definitions(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user defined symbols
)

# Remove wrong libob.a library dependency when using cpp files
list(REMOVE_ITEM CMAKE_C_IMPLICIT_LINK_LIBRARIES ob)

# Add linked libraries
target_link_libraries(${CMAKE_PROJECT_NAME}
    stm32cubemx

    # Add user defined libraries
)

# Firmware update file for the tinyuf2 USB bootloader (docs/firmware.md):
# after every link, turn the elf into ratrocket.uf2 next to it. Copy that file
# onto the RATROCKET drive to flash the robot over USB-C. The objcopy next to
# the compiler is used, so the toolchain does not have to be on PATH.
get_filename_component(RATROCKET_TOOLCHAIN_DIR "${CMAKE_C_COMPILER}" DIRECTORY)
find_program(RATROCKET_OBJCOPY arm-none-eabi-objcopy HINTS "${RATROCKET_TOOLCHAIN_DIR}" REQUIRED)
find_package(Python3 COMPONENTS Interpreter)
if(Python3_Interpreter_FOUND)
    add_custom_command(TARGET ${CMAKE_PROJECT_NAME} POST_BUILD
        COMMAND "${RATROCKET_OBJCOPY}" -O binary
                "$<TARGET_FILE:${CMAKE_PROJECT_NAME}>" "${CMAKE_BINARY_DIR}/ratrocket.bin"
        COMMAND "${Python3_EXECUTABLE}" "${CMAKE_SOURCE_DIR}/tools/make_uf2.py"
                "${CMAKE_BINARY_DIR}/ratrocket.bin" "${CMAKE_BINARY_DIR}/ratrocket.uf2"
                --base 0x08010000 --limit 0x08060000 --family 0x57755A57
        BYPRODUCTS "${CMAKE_BINARY_DIR}/ratrocket.bin" "${CMAKE_BINARY_DIR}/ratrocket.uf2"
        COMMENT "Creating ratrocket.uf2"
        VERBATIM
    )
else()
    message(WARNING "Python 3 not found: ratrocket.uf2 (USB update file) will not be created")
endif()
