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
