#include "maze_queue.h"

/**
 * @brief Initializes the queue.
 * 
 * This function sets up the initial state of the queue.
 * 
 * @param queue Pointer to the queue to be initialized.
 */
void queueInit(QUEUE* queue)
{
    queue->front = 0;
    queue->rear = 0;
    queue->size =0;
}

/**
 * @brief Checks if the queue is empty.
 * 
 * This function returns true if the queue has no elements, otherwise false.
 * 
 * @param queue Pointer to the queue to be checked.
 * @return true if the queue is empty, false otherwise.
 */
bool queueIsEmpty(QUEUE* queue)
{
    return(queue->size == 0);
}

/**
 * @brief Pushes an element onto the queue.
 * 
 * This function adds an element to the end of the queue.
 * Always push element to queue->rear index.
 * 
 * @param queue Pointer to the queue where the element will be added.
 * @param element The element to be added to the queue.
 */
void queuePush(QUEUE* queue, CELL element)
{
    queue->data[queue->rear] = element;
    queue->rear = (queue->rear + 1) % QUEUE_MAX_SIZE;
    queue->size +=1;
}

/**
 * @brief Pops an element from the queue.
 * 
 * This function removes and returns the element at the front of the queue.
 * 
 * @param queue Pointer to the queue from which the element will be removed.
 * @return The element removed from the front of the queue.
 */
CELL queuePOP(QUEUE* queue)
{
    CELL element = queue->data[queue->front];
    queue->front = (queue->front + 1) % QUEUE_MAX_SIZE;
    queue->size -=1;
    return element;
}