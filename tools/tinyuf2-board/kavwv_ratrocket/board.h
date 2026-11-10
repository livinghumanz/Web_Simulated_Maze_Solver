/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 Ha Thach for Adafruit Industries
 * Copyright (c) 2026 KAVWV
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// KAVWV RatRocket micromouse, main board "Revenge of Rat Rocket PCB Rev 1":
// STM32F411RET6 (512 KB flash, 128 KB RAM), 25 MHz HSE crystal, USB-C on
// PA11/PA12. Modelled on stm32f411ce_blackpill (same die, same 25 MHz HSE),
// but with the application's slower clock tree, see clock_init() below.
//
// Flash map (the application linker script must match):
//   0x08000000  sectors 0-3  (64 KB)   this bootloader
//   0x08010000  sectors 4-6  (320 KB)  application (BOARD_FLASH_APP_START)
//   0x08060000  sector 7     (128 KB)  application settings - a UF2 file must
//                                      never contain blocks for this range

#ifndef BOARD_H_
#define BOARD_H_

//--------------------------------------------------------------------+
// LED
//--------------------------------------------------------------------+

// RGB LED (LED1 "led tricolor" / U9 TC5050RGBF07): RGB_Red PC8, RGB_Green PC9,
// RGB_Blue PB5. Schematic: each anode through 470R to its MCU pin, the common
// cathode to GND, so the LED is active high. The bootloader uses blue only.
#define LED_PORT              GPIOB
#define LED_PIN               GPIO_PIN_5
#define LED_STATE_ON          1

//--------------------------------------------------------------------+
// Neopixel
//--------------------------------------------------------------------+

// No addressable LED on this board
#define NEOPIXEL_NUMBER       0

//--------------------------------------------------------------------+
// Flash
//--------------------------------------------------------------------+

// Flash size of the board
#define BOARD_FLASH_SIZE      (512 * 1024)
#define BOARD_FLASH_SECTORS   8

//--------------------------------------------------------------------+
// USB UF2
//--------------------------------------------------------------------+

// pid.codes test PID (0x1209/0x0010). Request a permanent pid.codes
// allocation before shipping boards.
#define USB_VID           0x1209
#define USB_PID           0x0010
#define USB_MANUFACTURER  "KAVWV"
#define USB_PRODUCT       "RatRocket"

#define UF2_PRODUCT_NAME  USB_MANUFACTURER " " USB_PRODUCT
#define UF2_BOARD_ID      "KAVWV-RatRocket-F411RE-v1"
#define UF2_VOLUME_LABEL  "RATROCKET"
#define UF2_INDEX_URL     "https://www.kavvv.in"

// PA9 is USART1 TX on this board, not a VBUS sense input
#define USB_NO_VBUS_PIN   1

//--------------------------------------------------------------------+
// UART
//--------------------------------------------------------------------+

// USART1 on header J2 (PA9 TX, PA10 RX - the FTDI adapter). Only used by
// debug builds (cmake -DLOG=1 or higher); a normal build has no UART output.
// In UF2 mode board_dfu_init() takes PA10 as OTG_FS_ID, so only TX is usable.
#define UART_DEV              USART1
#define UART_CLOCK_ENABLE     __HAL_RCC_USART1_CLK_ENABLE
#define UART_CLOCK_DISABLE    __HAL_RCC_USART1_CLK_DISABLE
#define UART_GPIO_PORT        GPIOA
#define UART_GPIO_AF          GPIO_AF7_USART1
#define UART_TX_PIN           GPIO_PIN_9
#define UART_RX_PIN           GPIO_PIN_10

//--------------------------------------------------------------------+
// RCC Clock
//--------------------------------------------------------------------+

// The same clock tree as the RatRocket application, which runs stably on this
// board: 25 MHz HSE / 15 = 1.67 MHz VCO input, x144 = 240 MHz VCO,
// /6 = 40 MHz SYSCLK, /5 = 48 MHz USB clock (exact).
// The blackpill settings (1 MHz VCO input, 84 MHz SYSCLK, voltage scale 2,
// 2 wait states) made this board's bootloader crash at random during start-up
// (corrupted instruction fetches, NOCP/INVSTATE/IBUSERR faults), although VDD
// measured 3.29 V. Speed does not matter for a bootloader.
static inline void clock_init(void)
{
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};

  /* Enable Power Control clock */
  __HAL_RCC_PWR_CLK_ENABLE();

  /* Voltage scale 1 (the reset value is scale 2), as in the application */
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

  /* Enable HSE Oscillator and activate PLL with HSE as source */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLM = 15;
  RCC_OscInitStruct.PLL.PLLN = 144;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV6;
  RCC_OscInitStruct.PLL.PLLQ = 5;
  HAL_RCC_OscConfig(&RCC_OscInitStruct);

  /* Select PLL as system clock source and configure the HCLK, PCLK1 and PCLK2
     clocks dividers: 40 MHz needs 1 flash wait state at 2.7-3.6 V */
  RCC_ClkInitStruct.ClockType = (RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2);
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;
  HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_1);
}

#endif
