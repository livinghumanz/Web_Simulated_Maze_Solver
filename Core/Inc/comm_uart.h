#ifndef COMM_UART_H
#define COMM_UART_H

#include<stdint.h>

/* Initialize UART DMA reception */
void UART_Comm_Init(void);

/* Send string over UART */
void UART_SendString(const char *msg);


#endif