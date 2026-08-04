#include "FreeRTOS.h"
#include "main.h"
#include "comm_uart.h"
#include "stm32f411xe.h"
#include "usart.h"
#include <stdint.h>
#include <string.h>
#include "cmsis_os2.h"

#define RX_BUFFER_SIZE 20

// uint8_t ProcessingBufferA[RX_BUFFER_SIZE];
// uint8_t ProcessingBufferB[RX_BUFFER_SIZE];
// static uint8_t bufferToggle = 0;

uint8_t uartRxBuffer[RX_BUFFER_SIZE];

extern osMessageQueueId_t mazeQueueHandle;

void UART_Comm_Init(void)
{
    HAL_UARTEx_ReceiveToIdle_DMA(&huart1, uartRxBuffer, RX_BUFFER_SIZE);
    __HAL_DMA_DISABLE_IT(huart1.hdmarx, DMA_IT_HT);
}

void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
{
    if(huart != &huart1) return;

    if (Size < RX_BUFFER_SIZE) {
        uartRxBuffer[Size] = '\0';
    }else {
        uartRxBuffer[RX_BUFFER_SIZE - 1] = '\0';
    }

    // uint8_t* pMazeDataToSend = NULL;

    // if(bufferToggle == 0)
    // {
    //     memcpy(ProcessingBufferA, uartRxBuffer, RX_BUFFER_SIZE);
    //     pMazeDataToSend = ProcessingBufferA;
    //     bufferToggle = 1;
    // }else {
    //     memcpy(ProcessingBufferB, uartRxBuffer, RX_BUFFER_SIZE);
    //     pMazeDataToSend = ProcessingBufferB;
    //     bufferToggle = 0;
    // }

    if (mazeQueueHandle != NULL && (Size > 1)) {
        osMessageQueuePut(mazeQueueHandle, uartRxBuffer, 0, 0);
    }


    // 4. Restart the DMA for the next 10 bytes (Crucial for Normal Mode)
    HAL_UARTEx_ReceiveToIdle_DMA(&huart1, uartRxBuffer, RX_BUFFER_SIZE);

    // 5. Disable Half-Transfer interrupt again for the new cycle
    __HAL_DMA_DISABLE_IT(huart1.hdmarx, DMA_IT_HT);

}