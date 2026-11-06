#include "battery.h"

#include <stdbool.h>

#include "FreeRTOS.h"
#include "task.h"
#include "adc.h"

/* Divider: 47k (top) / 22k (bottom) -> Vbat = Vadc * 69 / 22.
 * NOTE: the schematic shows 47k / 18k (see docs/hardware.md). Only ratios of
 * readings are used for motor compensation, so the scale error cancels. */
#define ADC_REF_MV   3300UL
#define ADC_MAX      4095UL
#define DIV_NUM      69UL
#define DIV_DEN      22UL

uint32_t Battery_ReadMv(void)
{
    /* The motion task and console tasks may both read: lock the scheduler for
     * the ~25 us conversion so HAL ADC calls never interleave. */
    bool rtos = (xTaskGetSchedulerState() == taskSCHEDULER_RUNNING);
    if (rtos) {
        vTaskSuspendAll();
    }
    uint32_t raw = 0;
    HAL_ADC_Start(&hadc1);
    if (HAL_ADC_PollForConversion(&hadc1, 2) == HAL_OK) {
        raw = HAL_ADC_GetValue(&hadc1);
    }
    HAL_ADC_Stop(&hadc1);
    if (rtos) {
        (void)xTaskResumeAll();
    }
    return (raw * ADC_REF_MV / ADC_MAX) * DIV_NUM / DIV_DEN;
}
