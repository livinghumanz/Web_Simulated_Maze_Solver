#include "ultrasonic.h"

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "main.h"

#define US_TRIG_US        12U       /* HC-SR04 needs >= 10 us                 */
#define US_TIMEOUT_MS     30U       /* give up on an echo after this          */
#define US_GAP_MS         8U        /* let reflections die before next ping   */
#define US_MAX_MM         2000U
#define SOUND_MM_PER_US   0.1715f   /* 343 m/s, halved for the round trip     */
#define US_IRQ_PRIORITY   6U

typedef struct {
    GPIO_TypeDef *trig_port;
    uint16_t trig_pin;
    uint16_t echo_pin;        /* all echo pins are on GPIOA */
    IRQn_Type irq;
} UsHw;

static const UsHw s_hw[US_COUNT] = {
    { GPIOB, GPIO_PIN_10, GPIO_PIN_1, EXTI1_IRQn },   /* US1 */
    { GPIOA, GPIO_PIN_4,  GPIO_PIN_2, EXTI2_IRQn },   /* US2 */
    { GPIOA, GPIO_PIN_5,  GPIO_PIN_3, EXTI3_IRQn },   /* US3 */
};

static volatile uint32_t s_rise[US_COUNT];
static volatile uint32_t s_fall[US_COUNT];
static volatile uint8_t s_armed[US_COUNT];    /* 1 = waiting for rise, 2 = for fall */
static volatile uint8_t s_done[US_COUNT];
static volatile uint16_t s_mm[US_COUNT] = { US_FAR_MM, US_FAR_MM, US_FAR_MM };
static volatile uint32_t s_count[US_COUNT];

static osThreadId_t s_task;
static const osThreadAttr_t s_task_attr = {
    .name = "ultrasonic",
    .stack_size = 192 * 4,
    .priority = (osPriority_t)osPriorityAboveNormal,
};

/* ---------------- echo interrupts ---------------- */

static void echo_edge(uint8_t i)
{
    uint32_t t = DWT->CYCCNT;
    bool high = (GPIOA->IDR & s_hw[i].echo_pin) != 0U;
    if (high && s_armed[i] == 1U) {
        s_rise[i] = t;
        s_armed[i] = 2U;
    } else if (!high && s_armed[i] == 2U) {
        s_fall[i] = t;
        s_armed[i] = 0U;
        s_done[i] = 1U;
    }
}

void EXTI1_IRQHandler(void)
{
    if (EXTI->PR & GPIO_PIN_1) { EXTI->PR = GPIO_PIN_1; echo_edge(0); }
}

void EXTI2_IRQHandler(void)
{
    if (EXTI->PR & GPIO_PIN_2) { EXTI->PR = GPIO_PIN_2; echo_edge(1); }
}

void EXTI3_IRQHandler(void)
{
    if (EXTI->PR & GPIO_PIN_3) { EXTI->PR = GPIO_PIN_3; echo_edge(2); }
}

/* ---------------- measuring task ---------------- */

static void delay_us(uint32_t us)
{
    uint32_t start = DWT->CYCCNT;
    uint32_t ticks = us * (SystemCoreClock / 1000000U);
    while ((DWT->CYCCNT - start) < ticks) { }
}

static void measure(uint8_t i)
{
    s_done[i] = 0U;
    s_armed[i] = 1U;

    HAL_GPIO_WritePin(s_hw[i].trig_port, s_hw[i].trig_pin, GPIO_PIN_SET);
    delay_us(US_TRIG_US);
    HAL_GPIO_WritePin(s_hw[i].trig_port, s_hw[i].trig_pin, GPIO_PIN_RESET);

    for (uint32_t t = 0; t < US_TIMEOUT_MS && !s_done[i]; t++) {
        osDelay(1);
    }

    uint16_t mm = US_FAR_MM;
    if (s_done[i]) {
        uint32_t us = (s_fall[i] - s_rise[i]) / (SystemCoreClock / 1000000U);
        float d = (float)us * SOUND_MM_PER_US;
        if (d < (float)US_MAX_MM) {
            mm = (uint16_t)d;
        }
    }
    s_armed[i] = 0U;
    s_mm[i] = mm;
    s_count[i]++;
}

static void ultrasonic_task(void *arg)
{
    (void)arg;
    for (;;) {
        for (uint8_t i = 0; i < US_COUNT; i++) {
            measure(i);
            osDelay(US_GAP_MS);
        }
    }
}

/* ---------------- API ---------------- */

void Ultrasonic_Start(void)
{
    if (s_task != NULL) {
        return;
    }

    /* Cycle counter for echo timing. */
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT = 0;
    DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;

    /* TRIG pins: push-pull outputs, idle low. (PA4/PA5 were ADC inputs.) */
    GPIO_InitTypeDef g = {0};
    g.Mode = GPIO_MODE_OUTPUT_PP;
    g.Pull = GPIO_NOPULL;
    g.Speed = GPIO_SPEED_FREQ_LOW;
    for (uint8_t i = 0; i < US_COUNT; i++) {
        HAL_GPIO_WritePin(s_hw[i].trig_port, s_hw[i].trig_pin, GPIO_PIN_RESET);
        g.Pin = s_hw[i].trig_pin;
        HAL_GPIO_Init(s_hw[i].trig_port, &g);
    }

    /* ECHO pins: inputs with interrupts on both edges. The pull-down keeps
     * them quiet when no sensor is plugged in. */
    g.Pin = GPIO_PIN_1 | GPIO_PIN_2 | GPIO_PIN_3;
    g.Mode = GPIO_MODE_IT_RISING_FALLING;
    g.Pull = GPIO_PULLDOWN;
    HAL_GPIO_Init(GPIOA, &g);

    for (uint8_t i = 0; i < US_COUNT; i++) {
        HAL_NVIC_SetPriority(s_hw[i].irq, US_IRQ_PRIORITY, 0);
        HAL_NVIC_EnableIRQ(s_hw[i].irq);
    }

    s_task = osThreadNew(ultrasonic_task, NULL, &s_task_attr);
}

uint16_t Ultrasonic_GetMm(uint8_t ch)
{
    return (ch < US_COUNT) ? s_mm[ch] : US_FAR_MM;
}

uint32_t Ultrasonic_GetCount(uint8_t ch)
{
    return (ch < US_COUNT) ? s_count[ch] : 0U;
}

static uint16_t median(uint16_t *v, uint8_t n)
{
    for (uint8_t i = 1; i < n; i++) {            /* insertion sort, n is tiny */
        uint16_t x = v[i];
        int8_t j = (int8_t)i - 1;
        while (j >= 0 && v[j] > x) {
            v[j + 1] = v[j];
            j--;
        }
        v[j + 1] = x;
    }
    return v[n / 2U];
}

void Ultrasonic_ReadMedian(uint16_t out[US_COUNT], uint8_t n)
{
    enum { MAX_N = 7 };
    uint16_t buf[US_COUNT][MAX_N];
    if (n == 0U) n = 1U;
    if (n > MAX_N) n = MAX_N;

    uint32_t last[US_COUNT];
    uint8_t got[US_COUNT] = {0};
    for (uint8_t ch = 0; ch < US_COUNT; ch++) {
        last[ch] = s_count[ch];
    }
    /* Collect fresh readings from all channels in parallel. */
    for (uint32_t waited = 0; waited < 2000U; waited += 2U) {
        bool all = true;
        for (uint8_t ch = 0; ch < US_COUNT; ch++) {
            if (got[ch] >= n) {
                continue;
            }
            all = false;
            if (s_count[ch] != last[ch]) {
                last[ch] = s_count[ch];
                buf[ch][got[ch]++] = s_mm[ch];
            }
        }
        if (all) {
            break;
        }
        osDelay(2);
    }
    for (uint8_t ch = 0; ch < US_COUNT; ch++) {
        out[ch] = got[ch] ? median(buf[ch], got[ch]) : US_FAR_MM;
    }
}
