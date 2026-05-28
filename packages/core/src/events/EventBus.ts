/**
 * MetaCLI Core — Typed Event Bus
 *
 * The nervous system of MetaCLI. All components communicate through
 * this typed event bus, enabling loose coupling and plugin extensibility.
 */

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export class EventBus<TEvents extends Record<string, any> = Record<string, any>> {
  private handlers = new Map<string, Set<EventHandler>>();
  private onceHandlers = new Map<string, Set<EventHandler>>();
  private history: Array<{ event: string; data: any; timestamp: number }> = [];
  private readonly maxHistorySize = 200;

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends keyof TEvents & string>(
    event: K,
    handler: EventHandler<TEvents[K]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  /**
   * Subscribe to an event, but only fire once.
   */
  once<K extends keyof TEvents & string>(
    event: K,
    handler: EventHandler<TEvents[K]>,
  ): () => void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler as EventHandler);

    return () => {
      this.onceHandlers.get(event)?.delete(handler as EventHandler);
    };
  }

  /**
   * Emit an event to all subscribers. Handlers run concurrently.
   */
  async emit<K extends keyof TEvents & string>(event: K, data: TEvents[K]): Promise<void> {
    // Save to historical sliding buffer for cognitive event observability
    this.history.push({
      event,
      data,
      timestamp: Date.now(),
    });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const promises: Promise<void>[] = [];

    // Regular handlers
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }

    // Once handlers — fire and remove
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
      this.onceHandlers.delete(event);
    }

    // Wait for all async handlers
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Query event logs history for replayability and diagnostic traces.
   */
  getHistory(): Array<{ event: string; data: any; timestamp: number }> {
    return [...this.history];
  }

  /**
   * Clear event history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Remove all handlers for a specific event, or all events.
   */
  off<K extends keyof TEvents & string>(event?: K): void {
    if (event) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  /**
   * Get the number of listeners for a given event.
   */
  listenerCount<K extends keyof TEvents & string>(event: K): number {
    return (this.handlers.get(event)?.size ?? 0) + (this.onceHandlers.get(event)?.size ?? 0);
  }
}
