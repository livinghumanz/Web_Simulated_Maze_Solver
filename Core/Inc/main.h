/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2026 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */

/* Define to prevent recursive inclusion -------------------------------------*/
#ifndef __MAIN_H
#define __MAIN_H

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include "stm32f4xx_hal.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */

/* USER CODE END Includes */

/* Exported types ------------------------------------------------------------*/
/* USER CODE BEGIN ET */

/* USER CODE END ET */

/* Exported constants --------------------------------------------------------*/
/* USER CODE BEGIN EC */

/* USER CODE END EC */

/* Exported macro ------------------------------------------------------------*/
/* USER CODE BEGIN EM */

/* USER CODE END EM */

/* Exported functions prototypes ---------------------------------------------*/
void Error_Handler(void);

/* USER CODE BEGIN EFP */

/* USER CODE END EFP */

/* Private defines -----------------------------------------------------------*/
#define Motor_Error_Pin_Pin GPIO_PIN_13
#define Motor_Error_Pin_GPIO_Port GPIOC
#define Select_Switch_1_Pin GPIO_PIN_0
#define Select_Switch_1_GPIO_Port GPIOC
#define Select_Switch_2_Pin GPIO_PIN_1
#define Select_Switch_2_GPIO_Port GPIOC
#define Select_Switch_3_Pin GPIO_PIN_2
#define Select_Switch_3_GPIO_Port GPIOC
#define Select_Switch_4_Pin GPIO_PIN_3
#define Select_Switch_4_GPIO_Port GPIOC
#define Battery_Voltage_Pin GPIO_PIN_0
#define Battery_Voltage_GPIO_Port GPIOA
#define Motor_1A_Pin GPIO_PIN_6
#define Motor_1A_GPIO_Port GPIOA
#define Motor_1B_Pin GPIO_PIN_7
#define Motor_1B_GPIO_Port GPIOA
#define INT_Open_Drain_IMU_Pin GPIO_PIN_4
#define INT_Open_Drain_IMU_GPIO_Port GPIOC
#define FSync_IMU_Pin GPIO_PIN_5
#define FSync_IMU_GPIO_Port GPIOC
#define Motor_2B_Pin GPIO_PIN_0
#define Motor_2B_GPIO_Port GPIOB
#define Motor_2A_Pin GPIO_PIN_1
#define Motor_2A_GPIO_Port GPIOB
#define BOOT_2_Pin GPIO_PIN_2
#define BOOT_2_GPIO_Port GPIOB
#define G1_Pin GPIO_PIN_10
#define G1_GPIO_Port GPIOB
#define SPI_2_CS_Pin GPIO_PIN_12
#define SPI_2_CS_GPIO_Port GPIOB
#define RGB_Red_Pin GPIO_PIN_8
#define RGB_Red_GPIO_Port GPIOC
#define RGB_Green_Pin GPIO_PIN_9
#define RGB_Green_GPIO_Port GPIOC
#define Motor1_Encoder_A_Pin GPIO_PIN_15
#define Motor1_Encoder_A_GPIO_Port GPIOA
#define SPI_3_CS_Pin GPIO_PIN_2
#define SPI_3_CS_GPIO_Port GPIOD
#define Motor1_Encoder_B_Pin GPIO_PIN_3
#define Motor1_Encoder_B_GPIO_Port GPIOB
#define RGB_Blue_Pin GPIO_PIN_5
#define RGB_Blue_GPIO_Port GPIOB
#define Motor2_Encoder_A_Pin GPIO_PIN_6
#define Motor2_Encoder_A_GPIO_Port GPIOB
#define Motor2_Encoder_B_Pin GPIO_PIN_7
#define Motor2_Encoder_B_GPIO_Port GPIOB

/* USER CODE BEGIN Private defines */

/* USER CODE END Private defines */

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
