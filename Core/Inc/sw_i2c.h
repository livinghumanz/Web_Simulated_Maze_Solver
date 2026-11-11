#ifndef __SW_I2C_MULTI_H__
#define __SW_I2C_MULTI_H__

#include "stm32f4xx_hal.h"
#include <stdint.h>

typedef struct
{
    GPIO_TypeDef *SCL_Port;
    uint16_t      SCL_Pin;

    GPIO_TypeDef *SDA_Port;
    uint16_t      SDA_Pin;

    uint32_t      DelayTicks;   // tune speed (bigger = slower)
} SWI2C_Bus_t;

/* Core bus API */
void    SWI2C_Init(SWI2C_Bus_t *bus);
void    SWI2C_Start(SWI2C_Bus_t *bus);
void    SWI2C_Stop(SWI2C_Bus_t *bus);

/* Return value convention (IMPORTANT):
 *  - SWI2C_WriteByte() returns 1 if ACK received, 0 if NACK
 */
uint8_t SWI2C_WriteByte(SWI2C_Bus_t *bus, uint8_t data);
uint8_t SWI2C_ReadByte (SWI2C_Bus_t *bus, uint8_t ack);   // ack=1 send ACK, ack=0 send NACK

/* Helpers */
void    SWI2C_Scan(SWI2C_Bus_t *bus, const char *bus_name);

/* Register read/write helpers (very useful for MPU6050 etc.) */
uint8_t SWI2C_WriteReg(SWI2C_Bus_t *bus, uint8_t addr7, uint8_t reg, uint8_t val);
uint8_t SWI2C_ReadRegs(SWI2C_Bus_t *bus, uint8_t addr7, uint8_t reg, uint8_t *buf, uint16_t len);

#endif
