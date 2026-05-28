/**
 * MetaCLI Core — Cognitive Runtime Loop
 *
 * Coordinates execution lifecycles, moving through state bounds:
 * OBSERVING → CLASSIFYING → RETRIEVING → PLANNING → SHAPING → ROUTING → EXECUTING → REFLECTING → LEARNING
 */

export type LoopState =
  | 'OBSERVING'
  | 'CLASSIFYING'
  | 'RETRIEVING'
  | 'PLANNING'
  | 'SHAPING'
  | 'ROUTING'
  | 'EXECUTING'
  | 'REFLECTING'
  | 'LEARNING';

export class CognitiveRuntimeLoop {
  private eventBus: any;
  private currentState: LoopState = 'OBSERVING';

  constructor(eventBus?: any) {
    this.eventBus = eventBus;
  }

  /**
   * Transition to a new state and notify event listeners.
   */
  transition(newState: LoopState): void {
    const oldState = this.currentState;
    this.currentState = newState;

    if (this.eventBus) {
      this.eventBus.emit('cognitive.loop.transitioned', {
        oldState,
        newState,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Gets the active state.
   */
  getState(): LoopState {
    return this.currentState;
  }
}
