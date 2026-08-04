/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * File Name          : freertos.c
  * Description        : Code for freertos applications
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

/* Includes ------------------------------------------------------------------*/
#include "FreeRTOS.h"
#include "task.h"
#include "main.h"
#include "cmsis_os.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */

#include "debug_log.h"
#include "motor.h"
#include "maze_main.h"
#include <stdint.h>
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
/* USER CODE BEGIN Variables */

/* USER CODE END Variables */
/* Definitions for defaultTask */
osThreadId_t defaultTaskHandle;
const osThreadAttr_t defaultTask_attributes = {
  .name = "defaultTask",
  .stack_size = 512 * 4,
  .priority = (osPriority_t) osPriorityNormal,
};
/* Definitions for motorQueue */
osMessageQueueId_t motorQueueHandle;
const osMessageQueueAttr_t motorQueue_attributes = {
  .name = "motorQueue"
};
/* Definitions for mazeQueue */
osMessageQueueId_t mazeQueueHandle;
const osMessageQueueAttr_t mazeQueue_attributes = {
  .name = "mazeQueue"
};

/* Private function prototypes -----------------------------------------------*/
/* USER CODE BEGIN FunctionPrototypes */

osThreadId_t encoderTaskHandle;
const osThreadAttr_t encoderTask_attributes = {
  .name = "encoderTask",
  .stack_size = 128 * 4,
  .priority = (osPriority_t) osPriorityNormal,
};

void StartEncoderTask(void *argument);

/* USER CODE END FunctionPrototypes */

void StartDefaultTask(void *argument);

extern void MX_USB_DEVICE_Init(void);
void MX_FREERTOS_Init(void); /* (MISRA C 2004 rule 8.1) */

/**
  * @brief  FreeRTOS initialization
  * @param  None
  * @retval None
  */
void MX_FREERTOS_Init(void) {
  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* USER CODE BEGIN RTOS_MUTEX */
  /* add mutexes, ... */
  /* USER CODE END RTOS_MUTEX */

  /* USER CODE BEGIN RTOS_SEMAPHORES */
  /* add semaphores, ... */
  /* USER CODE END RTOS_SEMAPHORES */

  /* USER CODE BEGIN RTOS_TIMERS */
  /* start timers, add new ones, ... */
  /* USER CODE END RTOS_TIMERS */

  /* Create the queue(s) */
  /* creation of motorQueue */
  motorQueueHandle = osMessageQueueNew (4, sizeof(uint8_t), &motorQueue_attributes);

  /* creation of mazeQueue */
  mazeQueueHandle = osMessageQueueNew (4, 20, &mazeQueue_attributes);

  /* USER CODE BEGIN RTOS_QUEUES */
  /* add queues, ... */
  /* USER CODE END RTOS_QUEUES */

  /* Create the thread(s) */
  /* creation of defaultTask */
  defaultTaskHandle = osThreadNew(StartDefaultTask, NULL, &defaultTask_attributes);

  /* USER CODE BEGIN RTOS_THREADS */
  /* add threads, ... */
  encoderTaskHandle = osThreadNew(StartEncoderTask, NULL, &encoderTask_attributes);
  /* USER CODE END RTOS_THREADS */

  /* USER CODE BEGIN RTOS_EVENTS */
  /* add events, ... */
  /* USER CODE END RTOS_EVENTS */

}

/* USER CODE BEGIN Header_StartDefaultTask */
/**
  * @brief  Function implementing the defaultTask thread.
  * @param  argument: Not used
  * @retval None
  */
/* USER CODE END Header_StartDefaultTask */
void StartDefaultTask(void *argument)
{
  /* init code for USB_DEVICE */
  MX_USB_DEVICE_Init();
  /* USER CODE BEGIN StartDefaultTask */

  stop_Slow();

  LOG_INFO("Main Maze begins");
  /*
  * Initialise the Walls based on out "L" finger rule.
  * All boundaries are marked as wall present and rest all as unseen
  */
  initWalls();

  // assign the goal.
  CELL goal = END;

  // set current cell to 0,0
  CURRENT_CELL.x = 0;
  CURRENT_CELL.y = 0;
  
  // Set current pointing Direction
  CURRENT_ABSOLUTE_DIRECTION = NORTH;

  /* Infinite loop */
  for(;;)
  {
    // SEND_TMSG("%s", test_Var);
    // do update walls and propagate Cost till current cell != goal
    gotoGoal(goal);
    osDelay(100);
    // give home as new goal and make the bot come back. 
    // gotoGoal((CELL){0,0});
    // osDelay(100);
    LOG_INFO("Reached Home");
    
  }
  /* USER CODE END StartDefaultTask */
}

/* Private application code --------------------------------------------------*/
/* USER CODE BEGIN Application */

void StartEncoderTask(void *argument)
{
  /* USER CODE BEGIN StartEncoderTask */

  static int32_t prev_count_LE = 0;     // for Left Encoder
  static uint8_t prev_dir_LE = 0xFF;   // invalid initial value for Left Encoder

  static int32_t prev_count_RE = 0;     // for Right Encoder
  static uint8_t prev_dir_RE = 0xFF;   // invalid initial value for Right Encoder

  // Get the motor Direction values from the Queue
  MotionDirection nextMove = NONE;

   /* Infinite loop */
  /* Infinite loop */
  for(;;)
  {
    if (osMessageQueueGet(motorQueueHandle, &nextMove, 0, osWaitForever) == osOK) {
      switch (nextMove) {
        case FORWARD: {
          SEND_TMSG("FORWARD");
          // forward(850, 850);
          // osDelay(200);
          // stop_Slow();
         }
        break;
        case REVERSE: {SEND_TMSG("REVERSE"); 
          // reverse(850, 850); osDelay(200); stop_Slow();
        } break;
        case LEFT: {SEND_TMSG("LEFT"); 
          // left(850, 850); osDelay(200); stop_Slow();
        } break;
        case RIGHT: {SEND_TMSG("RIGHT"); 
          // right(850, 850); osDelay(200); stop_Slow();
        } break;
        case UTURN: {SEND_TMSG("UTURN"); 
          // uTurn(850, 850); osDelay(200);
        } break;
        case NONE: {SEND_TMSG("NONE");} break;
        default:
      }
    }
    

  }
}

/* USER CODE END Application */

