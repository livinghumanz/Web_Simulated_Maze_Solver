#include "motor.h"
#include "cmsis_os2.h"
#include "stm32f411xe.h"
#include "tim.h"
#include "debug_log.h"
#include <stdint.h>

void forward(uint16_t duty_L, uint16_t duty_R) {
	
	TIM3->CCR1 = duty_R;    //Right Motor
	TIM3->CCR2 = 0;			//Right Motor
	TIM3->CCR3 = duty_L;	//Left Motor
	TIM3->CCR4 = 0;			//Left Motor
}
void reverse(uint16_t duty_L, uint16_t duty_R) {
	TIM3->CCR1 = 0;
	TIM3->CCR2 = duty_R;
	TIM3->CCR3 = 0;
	TIM3->CCR4 = duty_L;
}
void left(uint16_t duty_L, uint16_t duty_R) {
    TIM3->CCR1 = duty_R;
    TIM3->CCR2 = 0;
    TIM3->CCR3 = 0;
    TIM3->CCR4 = duty_L;
}
void right(uint16_t duty_L, uint16_t duty_R) {
    TIM3->CCR1 = 0;
    TIM3->CCR2 = duty_R;
    TIM3->CCR3 = duty_L;
    TIM3->CCR4 = 0;
}
void stop_Slow() {
	TIM3->CCR1 = 0;
	TIM3->CCR2 = 0;
	TIM3->CCR3 = 0;
	TIM3->CCR4 = 0;
}
void stop_Fast() {
	TIM3->CCR1 = 800;
	TIM3->CCR2 = 800;
	TIM3->CCR3 = 800;
	TIM3->CCR4 = 800;
}

/* Set to -1 if a wheel spins backwards on a positive duty (see SWEEP). */
#define MOTOR_LEFT_DIR   (+1)
#define MOTOR_RIGHT_DIR  (+1)

static uint16_t clamp_duty(int32_t d)
{
	if (d < 0) d = -d;
	return (d > MOTOR_PWM_MAX) ? MOTOR_PWM_MAX : (uint16_t)d;
}

void Motor_SetLeft(int16_t duty)
{
	int32_t d = MOTOR_LEFT_DIR * (int32_t)duty;
	if (d >= 0) {
		TIM3->CCR4 = 0;
		TIM3->CCR3 = clamp_duty(d);
	} else {
		TIM3->CCR3 = 0;
		TIM3->CCR4 = clamp_duty(d);
	}
}

void Motor_SetRight(int16_t duty)
{
	int32_t d = MOTOR_RIGHT_DIR * (int32_t)duty;
	if (d >= 0) {
		TIM3->CCR2 = 0;
		TIM3->CCR1 = clamp_duty(d);
	} else {
		TIM3->CCR1 = 0;
		TIM3->CCR2 = clamp_duty(d);
	}
}

void Motor_SetPwm(int16_t left, int16_t right)
{
	Motor_SetLeft(left);
	Motor_SetRight(right);
}

void Motor_BrakeLeft(void)  { TIM3->CCR3 = MOTOR_PWM_MAX; TIM3->CCR4 = MOTOR_PWM_MAX; }
void Motor_BrakeRight(void) { TIM3->CCR1 = MOTOR_PWM_MAX; TIM3->CCR2 = MOTOR_PWM_MAX; }
void Motor_Brake(void)      { Motor_BrakeLeft(); Motor_BrakeRight(); }
void Motor_Coast(void)      { TIM3->CCR1 = 0; TIM3->CCR2 = 0; TIM3->CCR3 = 0; TIM3->CCR4 = 0; }

/* TIM3 sits on APB1; its kernel clock is 2x PCLK1 when the APB1 prescaler != 1. */
static uint32_t tim3_clock_hz(void)
{
	uint32_t pclk1 = HAL_RCC_GetPCLK1Freq();
	return ((RCC->CFGR & RCC_CFGR_PPRE1) != 0U) ? 2U * pclk1 : pclk1;
}

uint32_t Motor_GetPwmFrequency(void)
{
	return tim3_clock_hz() / ((TIM3->PSC + 1U) * (TIM3->ARR + 1U));
}

uint32_t Motor_SetPwmFrequency(uint32_t hz)
{
	if (hz == 0U) {
		return Motor_GetPwmFrequency();
	}
	uint32_t ticks = hz * (TIM3->ARR + 1U);
	uint32_t div = (tim3_clock_hz() + ticks / 2U) / ticks;   /* nearest divider */
	uint32_t psc = (div > 0U) ? div - 1U : 0U;
	if (psc > 0xFFFFU) {
		psc = 0xFFFFU;
	}
	TIM3->PSC = psc;
	TIM3->EGR = TIM_EGR_UG;   /* load the new prescaler now */
	return Motor_GetPwmFrequency();
}

// give Direction 0 for Reverse and >0 for Forward (Value 1 is prefered)
void spinLeft(uint16_t duty_L, uint8_t dir_l){
	if(!!dir_l)
	{
		// Move the Bot Left Motor Reverse
		TIM3->CCR3 = 0;	//Left Motor
		TIM3->CCR4 = duty_L;
	}else {
		// Move the Bot Left Motor Front
		TIM3->CCR3 = duty_L;	//Left Motor
		TIM3->CCR4 = 0;
	}
}

void Print_Encoder_Left( int32_t * prev_count, uint8_t * prev_dir) {
	// Checking for Left Encoder
    int32_t count = (int32_t)TIM4->CNT;
    uint8_t dir = (TIM4->CR1 & TIM_CR1_DIR) ? 1 : 0;

	if ((count >= 2700 && count <= 4000)) {
		stop_Slow();
		uint8_t diff = count - 2650;
		LOG_INFO("DIFF : %d \n",diff);
		if(diff > 80 && diff < 150){
			reverse(800,800);
			osDelay(3);
			stop_Fast();
		}
		osDelay(300);
		TIM4->CNT = 0;
	}
	else {
		forward(850,850);
	}
    // print only if count or direction changes
	count = (int32_t)TIM4->CNT;
    if((count != *prev_count) || (dir != *prev_dir)){
      LOG_INFO("LEFT | Count: %ld | Dir: %s\r\n", 
        (long)count,
        dir ? "CCW": "CW");

	  *prev_count = count;
	  *prev_dir = dir;
    }
}

void Print_Encoder_Right( int32_t * prev_count, uint8_t * prev_dir) {
	// Checking for Right Encoder
    int32_t count = (int32_t)TIM2->CNT;
    uint8_t dir = (TIM2->CR1 & TIM_CR1_DIR) ? 1 : 0;

    // print only if count or direction changes
    if((count != *prev_count) || (dir != *prev_dir)){
      LOG_INFO("RIGHT | Count: %ld | Dir: %s\r\n", 
        (long)count,
        dir ? "CCW": "CW");

	  *prev_count = count;
	  *prev_dir = dir;
    }
}
