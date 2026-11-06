#include "encoder.h"

#include "tim.h"

/* Set to -1 if a wheel counts down while turning forward (see SWEEP output).
 * Right encoder counts down on forward motion (mirror-mounted motor), verified
 * 2026-11-06: SWEEP gave L=+1870 / R=-1750 cps with both wheels driving forward. */
#define ENC_LEFT_SIGN   (+1)
#define ENC_RIGHT_SIGN  (-1)

static uint16_t s_last_l;
static uint16_t s_last_r;
static volatile int32_t s_pos_l;
static volatile int32_t s_pos_r;

void Encoder_Init(void)
{
    s_last_l = (uint16_t)TIM4->CNT;
    s_last_r = (uint16_t)TIM2->CNT;
    s_pos_l = 0;
    s_pos_r = 0;
}

void Encoder_Update(void)
{
    uint16_t l = (uint16_t)TIM4->CNT;
    uint16_t r = (uint16_t)TIM2->CNT;
    s_pos_l += ENC_LEFT_SIGN * (int16_t)(uint16_t)(l - s_last_l);
    s_pos_r += ENC_RIGHT_SIGN * (int16_t)(uint16_t)(r - s_last_r);
    s_last_l = l;
    s_last_r = r;
}

int32_t Encoder_Left(void)  { return s_pos_l; }
int32_t Encoder_Right(void) { return s_pos_r; }
