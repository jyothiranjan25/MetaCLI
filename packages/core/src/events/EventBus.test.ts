import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus.js';

describe('EventBus', () => {
  it('should allow subscribing to and emitting events', async () => {
    const eventBus = new EventBus<{
      'test:event': { message: string };
    }>();
    
    const handler = vi.fn();
    eventBus.on('test:event', handler);

    await eventBus.emit('test:event', { message: 'hello world' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ message: 'hello world' });
  });

  it('should allow unsubscribing from events', async () => {
    const eventBus = new EventBus<{
      'test:event': { message: string };
    }>();
    
    const handler = vi.fn();
    const unsubscribe = eventBus.on('test:event', handler);

    unsubscribe();
    await eventBus.emit('test:event', { message: 'hello world' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support once-only handlers', async () => {
    const eventBus = new EventBus<{
      'test:event': { value: number };
    }>();
    
    const handler = vi.fn();
    eventBus.once('test:event', handler);

    await eventBus.emit('test:event', { value: 1 });
    await eventBus.emit('test:event', { value: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 1 });
  });

  it('should report correct listener counts', () => {
    const eventBus = new EventBus<{
      'event:a': void;
      'event:b': void;
    }>();

    const unsubscribe1 = eventBus.on('event:a', () => {});
    const unsubscribe2 = eventBus.on('event:a', () => {});
    eventBus.once('event:b', () => {});

    expect(eventBus.listenerCount('event:a')).toBe(2);
    expect(eventBus.listenerCount('event:b')).toBe(1);

    unsubscribe1();
    expect(eventBus.listenerCount('event:a')).toBe(1);

    unsubscribe2();
    expect(eventBus.listenerCount('event:a')).toBe(0);
  });

  it('should run async handlers and wait for them to finish', async () => {
    const eventBus = new EventBus<{
      'async:event': { delay: number };
    }>();

    let finished = false;
    eventBus.on('async:event', async (data) => {
      await new Promise((resolve) => setTimeout(resolve, data.delay));
      finished = true;
    });

    await eventBus.emit('async:event', { delay: 10 });
    expect(finished).toBe(true);
  });
});
