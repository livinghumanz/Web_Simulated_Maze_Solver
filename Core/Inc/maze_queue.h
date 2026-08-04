#ifndef QUEUE_H
#define QUEUE_H

#include "maze.h"

#define QUEUE_MAX_SIZE 250 // maximum number of element in the circular buffer.

typedef struct 
{
    CELL data[QUEUE_MAX_SIZE];
    uint8_t front; // used while dequeuing, always points the first element in the queue.
    uint8_t rear;  // used while push operation, always points the index where the next element should be pushed.
    uint8_t size;  // total elements present in the queue.
}QUEUE;

void queueInit(QUEUE* queue);
bool queueIsEmpty(QUEUE* queue);
void queuePush(QUEUE* queue, CELL element);
CELL queuePOP(QUEUE* queue);

#endif // QUEUE_H