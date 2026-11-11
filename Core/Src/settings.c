#include "settings.h"

#include <stddef.h>
#include <string.h>

#include "main.h"
#include "imu.h"
#include "maze_run.h"
#include "motion.h"

#define SETTINGS_ADDR     0x08060000UL   /* sector 7, kept out of the program by the linker script */
#define SETTINGS_SECTOR   FLASH_SECTOR_7
#define SETTINGS_MAGIC    0x52524346UL   /* "RRCF" */
#define SETTINGS_VERSION  2U             /* bump when the layout's meaning changes */

/* Version 1 (until 2026-11-11). Still accepted by Settings_Load, so a robot
 * updated to this firmware keeps its saved maze settings; the gyro fields then
 * start at their defaults. The next SAVE writes version 2. */
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
} SettingsV1;

/* Version 2: version 1 + gyro turn setting and the last good gyro bias. */
typedef struct {
    uint32_t magic;
    uint16_t version;
    uint16_t size;
    MazeConfig maze;
    float track_mm;
    float dist_scale;
    float trim_pct;
    uint8_t button_escape;
    uint8_t gyro_turn;        /* GYROTURN 0/1                                 */
    uint8_t gyro_bias_valid;  /* gyro_bias_dps holds a measured bias          */
    uint8_t pad;
    float gyro_bias_dps;      /* gyro Z zero-rate offset (raw axis), deg/s    */
    uint32_t checksum;
} Settings;

_Static_assert(sizeof(Settings) % 4U == 0U, "Settings must be programmable in words");
_Static_assert(offsetof(Settings, button_escape) == offsetof(SettingsV1, button_escape),
               "version 2 must start with the version 1 fields");

static uint32_t checksum(const void *data, size_t len)
{
    const uint8_t *p = (const uint8_t *)data;
    uint32_t sum = 0x12345678UL;
    for (size_t i = 0; i < len; i++) {
        sum = ((sum << 5) | (sum >> 27)) ^ p[i];
    }
    return sum;
}

/* The fields both versions share (identical layout up to button_escape). */
static void apply_common(const SettingsV1 *s, bool *button_escape)
{
    g_maze_cfg = s->maze;
    Motion_SetTrackWidth(s->track_mm);
    (void)Motion_SetDistanceScale(s->dist_scale);
    (void)Motion_SetTrim(s->trim_pct);
    if (button_escape != NULL) {
        *button_escape = (s->button_escape != 0U);
    }
}

bool Settings_Load(bool *button_escape)
{
    const SettingsV1 *v1 = (const SettingsV1 *)SETTINGS_ADDR;
    const Settings *s = (const Settings *)SETTINGS_ADDR;
    if (s->magic != SETTINGS_MAGIC) {
        return false;
    }
    if (s->version == SETTINGS_VERSION && s->size == sizeof(Settings) &&
        s->checksum == checksum(s, offsetof(Settings, checksum))) {
        apply_common(v1, button_escape);
        Motion_SetGyroTurn(s->gyro_turn != 0U);
        Imu_SetSavedBias(s->gyro_bias_valid != 0U, s->gyro_bias_dps);
        return true;
    }
    if (v1->version == 1U && v1->size == sizeof(SettingsV1) &&
        v1->checksum == checksum(v1, offsetof(SettingsV1, checksum))) {
        apply_common(v1, button_escape);
        return true;
    }
    return false;
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
    s.gyro_turn = Motion_GetGyroTurn() ? 1U : 0U;
    /* The bias in use: this session's calibration, else the one loaded. */
    float bias = 0.0f;
    if (Imu_GetBias(&bias) != IMU_BIAS_NONE) {
        s.gyro_bias_valid = 1U;
        s.gyro_bias_dps = bias;
    }
    s.checksum = checksum(&s, offsetof(Settings, checksum));

    HAL_FLASH_Unlock();
    bool ok = erase_sector();
    const uint32_t *w = (const uint32_t *)&s;
    for (size_t i = 0; ok && i < sizeof(s) / 4U; i++) {
        ok = HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, SETTINGS_ADDR + 4U * i, w[i]) == HAL_OK;
    }
    HAL_FLASH_Lock();
    ok = ok && memcmp((const void *)SETTINGS_ADDR, &s, sizeof(s)) == 0;
    if (ok) {
        /* The flash now holds this bias: keep imu.c's copy of "saved" in step
         * (it never replaces a calibration from this session). */
        Imu_SetSavedBias(s.gyro_bias_valid != 0U, s.gyro_bias_dps);
    }
    return ok;
}

bool Settings_Erase(void)
{
    HAL_FLASH_Unlock();
    bool ok = erase_sector();
    HAL_FLASH_Lock();
    return ok;
}
