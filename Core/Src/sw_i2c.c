#include "sw_i2c.h"
#include <stdio.h>

/* --- Internal helpers: switch SDA between OUT (drive) and IN (release) --- */
static void SDA_ConfigOD(SWI2C_Bus_t *bus)
{
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin   = bus->SDA_Pin;
    GPIO_InitStruct.Mode  = GPIO_MODE_OUTPUT_OD;     // open-drain
    GPIO_InitStruct.Pull  = GPIO_PULLUP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    HAL_GPIO_Init(bus->SDA_Port, &GPIO_InitStruct);
}

/* RatRocket change (2026-11-11): the vendor switched SDA with a full
 * HAL_GPIO_Init() three times per byte, which made a 2-byte register read take
 * ~0.85 ms at 40 MHz (-O0 build). SWI2C_Init() still configures the pin fully
 * (open-drain, pull-up, very high speed, above); afterwards only its two MODER
 * bits change (01 output / 00 input). OTYPER, PUPDR and OSPEEDR keep their
 * values, so the pin ends up exactly as the HAL calls left it. */
static void SDA_SetMode(SWI2C_Bus_t *bus, uint32_t mode)   /* 1 = output, 0 = input */
{
    uint32_t pos = 2U * (uint32_t)__builtin_ctz((unsigned)bus->SDA_Pin);
    uint32_t primask = __get_PRIMASK();
    __disable_irq();
    bus->SDA_Port->MODER = (bus->SDA_Port->MODER & ~(3UL << pos)) | (mode << pos);
    __set_PRIMASK(primask);
}

static void SDA_OutOD(SWI2C_Bus_t *bus)
{
    SDA_SetMode(bus, 1U);                            // drive (open-drain)
}

static void SDA_InPU(SWI2C_Bus_t *bus)
{
    SDA_SetMode(bus, 0U);                            // release line (pull-up stays on)
}

static void SCL_OutOD(SWI2C_Bus_t *bus)
{
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin   = bus->SCL_Pin;
    GPIO_InitStruct.Mode  = GPIO_MODE_OUTPUT_OD;     // open-drain
    GPIO_InitStruct.Pull  = GPIO_PULLUP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    HAL_GPIO_Init(bus->SCL_Port, &GPIO_InitStruct);
}

static inline void DELAY(SWI2C_Bus_t *bus)
{
    for (volatile uint32_t i = 0; i < bus->DelayTicks; i++) { __NOP(); }
}

static inline void SDA_H(SWI2C_Bus_t *bus) { HAL_GPIO_WritePin(bus->SDA_Port, bus->SDA_Pin, GPIO_PIN_SET); }
static inline void SDA_L(SWI2C_Bus_t *bus) { HAL_GPIO_WritePin(bus->SDA_Port, bus->SDA_Pin, GPIO_PIN_RESET); }
static inline void SCL_H(SWI2C_Bus_t *bus) { HAL_GPIO_WritePin(bus->SCL_Port, bus->SCL_Pin, GPIO_PIN_SET); }
static inline void SCL_L(SWI2C_Bus_t *bus) { HAL_GPIO_WritePin(bus->SCL_Port, bus->SCL_Pin, GPIO_PIN_RESET); }
static inline uint8_t SDA_R(SWI2C_Bus_t *bus){ return (uint8_t)HAL_GPIO_ReadPin(bus->SDA_Port, bus->SDA_Pin); }

void SWI2C_Init(SWI2C_Bus_t *bus)
{
    if (!bus) return;
    if (bus->DelayTicks == 0) bus->DelayTicks = 40;

    SCL_OutOD(bus);
    SDA_ConfigOD(bus);

    SDA_H(bus);
    SCL_H(bus);
    DELAY(bus);
}

void SWI2C_Start(SWI2C_Bus_t *bus)
{
    SDA_OutOD(bus);
    SDA_H(bus); SCL_H(bus);
    DELAY(bus);
    SDA_L(bus);
    DELAY(bus);
    SCL_L(bus);
    DELAY(bus);
}

void SWI2C_Stop(SWI2C_Bus_t *bus)
{
    SDA_OutOD(bus);
    SDA_L(bus);
    DELAY(bus);
    SCL_H(bus);
    DELAY(bus);
    SDA_H(bus);
    DELAY(bus);
}

/* returns 1 if ACK received, 0 if NACK */
uint8_t SWI2C_WriteByte(SWI2C_Bus_t *bus, uint8_t data)
{
    SDA_OutOD(bus);

    for (int i = 0; i < 8; i++)
    {
        (data & 0x80) ? SDA_H(bus) : SDA_L(bus);
        DELAY(bus);

        SCL_H(bus);
        DELAY(bus);
        SCL_L(bus);
        DELAY(bus);

        data <<= 1;
    }

    /* ACK cycle */
    SDA_InPU(bus);         // release SDA
    DELAY(bus);

    SCL_H(bus);
    DELAY(bus);

    uint8_t ack = (SDA_R(bus) == 0) ? 1 : 0;   // ACK = 0 on SDA
    SCL_L(bus);
    DELAY(bus);

    SDA_OutOD(bus);
    return ack;
}

uint8_t SWI2C_ReadByte(SWI2C_Bus_t *bus, uint8_t ack)
{
    uint8_t data = 0;

    SDA_InPU(bus); // release SDA for slave to drive

    for (int i = 0; i < 8; i++)
    {
        data <<= 1;
        SCL_H(bus);
        DELAY(bus);

        if (SDA_R(bus)) data |= 1;

        SCL_L(bus);
        DELAY(bus);
    }

    /* Send ACK/NACK */
    SDA_OutOD(bus);
    if (ack) SDA_L(bus); else SDA_H(bus);

    DELAY(bus);
    SCL_H(bus);
    DELAY(bus);
    SCL_L(bus);
    DELAY(bus);

    SDA_InPU(bus); // release again
    return data;
}

void SWI2C_Scan(SWI2C_Bus_t *bus, const char *bus_name)
{
    printf("\r\n[SW I2C SCAN] %s | SCL=%p:%u SDA=%p:%u\r\n",
           bus_name ? bus_name : "BUS",
           (void*)bus->SCL_Port, bus->SCL_Pin,
           (void*)bus->SDA_Port, bus->SDA_Pin);

    int found = 0;
    for (uint8_t addr = 0x03; addr < 0x78; addr++)
    {
        SWI2C_Start(bus);
        uint8_t ack = SWI2C_WriteByte(bus, (addr << 1) | 0); // write
        SWI2C_Stop(bus);

        if (ack)
        {
            printf("  Found: 0x%02X\r\n", addr);
            found++;
        }
    }
    if (!found) printf("  No I2C devices found.\r\n");
}

uint8_t SWI2C_WriteReg(SWI2C_Bus_t *bus, uint8_t addr7, uint8_t reg, uint8_t val)
{
    SWI2C_Start(bus);
    if (!SWI2C_WriteByte(bus, (addr7 << 1) | 0)) { SWI2C_Stop(bus); return 0; }
    if (!SWI2C_WriteByte(bus, reg))             { SWI2C_Stop(bus); return 0; }
    if (!SWI2C_WriteByte(bus, val))             { SWI2C_Stop(bus); return 0; }
    SWI2C_Stop(bus);
    return 1;
}

uint8_t SWI2C_ReadRegs(SWI2C_Bus_t *bus, uint8_t addr7, uint8_t reg, uint8_t *buf, uint16_t len)
{
    if (!buf || len == 0) return 0;

    SWI2C_Start(bus);
    if (!SWI2C_WriteByte(bus, (addr7 << 1) | 0)) { SWI2C_Stop(bus); return 0; }
    if (!SWI2C_WriteByte(bus, reg))             { SWI2C_Stop(bus); return 0; }

    SWI2C_Start(bus);
    if (!SWI2C_WriteByte(bus, (addr7 << 1) | 1)) { SWI2C_Stop(bus); return 0; }

    for (uint16_t i = 0; i < len; i++)
        buf[i] = SWI2C_ReadByte(bus, (i < (len - 1)) ? 1 : 0);

    SWI2C_Stop(bus);
    return 1;
}
