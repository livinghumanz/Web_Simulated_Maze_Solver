#include "settings.h"

#include <stddef.h>
#include <string.h>

#include "main.h"
#include "maze_run.h"
#include "motion.h"

#define SETTINGS_ADDR     0x08060000UL   /* sector 7, kept out of the program by the linker script */
#define SETTINGS_SECTOR   FLASH_SECTOR_7
#define SETTINGS_MAGIC    0x52524346UL   /* "RRCF" */
#define SETTINGS_VERSION  1U             /* bump when the layout's meaning changes */

typedef struct {
    uint32_t magic;
    uint16_t version;
    uint16_t size;
    MazeConfig maze;
    float track_mm;
    float dist_scale;
    float trim_pct;
    uint8_t button_escape;
    uint8_t pad[3];
    uint32_t checksum;
} Settings;

_Static_assert(sizeof(Settings) % 4U == 0U, "Settings must be programmable in words");

static uint32_t checksum(const Settings *s)
{
    const uint8_t *p = (const uint8_t *)s;
    uint32_t sum = 0x12345678UL;
    for (size_t i = 0; i < offsetof(Settings, checksum); i++) {
        sum = ((sum << 5) | (sum >> 27)) ^ p[i];
    }
    return sum;
}

bool Settings_Load(bool *button_escape)
{
    const Settings *s = (const Settings *)SETTINGS_ADDR;
    if (s->magic != SETTINGS_MAGIC || s->version != SETTINGS_VERSION ||
        s->size != sizeof(Settings) || s->checksum != checksum(s)) {
        return false;
    }
    g_maze_cfg = s->maze;
    Motion_SetTrackWidth(s->track_mm);
    (void)Motion_SetDistanceScale(s->dist_scale);
    (void)Motion_SetTrim(s->trim_pct);
    if (button_escape != NULL) {
        *button_escape = (s->button_escape != 0U);
    }
    return true;
}

static bool erase_sector(void)
{
    FLASH_EraseInitTypeDef e = {
        .TypeErase = FLASH_TYPEERASE_SECTORS,
        .Sector = SETTINGS_SECTOR,
        .NbSectors = 1,
        .VoltageRange = FLASH_VOLTAGE_RANGE_3,
    };
    uint32_t bad_sector = 0;
    __HAL_FLASH_CLEAR_FLAG(FLASH_FLAG_EOP | FLASH_FLAG_OPERR | FLASH_FLAG_WRPERR |
                           FLASH_FLAG_PGAERR | FLASH_FLAG_PGPERR | FLASH_FLAG_PGSERR);
    return HAL_FLASHEx_Erase(&e, &bad_sector) == HAL_OK;
}

bool Settings_Save(bool button_escape)
{
    Settings s;
    memset(&s, 0, sizeof(s));
    s.magic = SETTINGS_MAGIC;
    s.version = SETTINGS_VERSION;
    s.size = sizeof(Settings);
    s.maze = g_maze_cfg;
    s.track_mm = Motion_GetTrackWidth();
    s.dist_scale = Motion_GetDistanceScale();
    s.trim_pct = Motion_GetTrim();
    s.button_escape = button_escape ? 1U : 0U;
    s.checksum = checksum(&s);

    HAL_FLASH_Unlock();
    bool ok = erase_sector();
    const uint32_t *w = (const uint32_t *)&s;
    for (size_t i = 0; ok && i < sizeof(s) / 4U; i++) {
        ok = HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, SETTINGS_ADDR + 4U * i, w[i]) == HAL_OK;
    }
    HAL_FLASH_Lock();
    return ok && memcmp((const void *)SETTINGS_ADDR, &s, sizeof(s)) == 0;
}

bool Settings_Erase(void)
{
    HAL_FLASH_Unlock();
    bool ok = erase_sector();
    HAL_FLASH_Lock();
    return ok;
}
