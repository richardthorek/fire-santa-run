/**
 * Voice instruction utilities using Web Speech API
 * Provides text-to-speech functionality for navigation
 */

export interface VoiceSettings {
  enabled: boolean;
  rate: number;      // 0.1 to 10, default 1
  pitch: number;     // 0 to 2, default 1
  volume: number;    // 0 to 1, default 1
  language: string;  // 'en-AU' for Australian English
}

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: true,
  rate: 1,
  pitch: 1,
  volume: 1,
  language: 'en-AU',
};

interface QueuedInstruction {
  text: string;
  priority: 'low' | 'high';
  resolve: () => void;
  reject: (error: unknown) => void;
}

class VoiceInstructionService {
  private synthesis: SpeechSynthesis | null = null;
  private settings: VoiceSettings = DEFAULT_SETTINGS;
  private voice: SpeechSynthesisVoice | null = null;
  /** Internal queue of pending voice instructions. */
  private queue: QueuedInstruction[] = [];
  private isProcessingQueue = false;
  /** Callback invoked whenever speech starts (with the text being spoken). */
  private onSpeakStartCallback: ((text: string) => void) | null = null;
  /** Callback invoked whenever speech ends or the queue is drained. */
  private onSpeakEndCallback: (() => void) | null = null;

  constructor() {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
      
      // Voices may not be immediately available
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices() {
    if (!this.synthesis) return;

    const voices = this.synthesis.getVoices();
    
    // Prefer Australian English voice
    this.voice = voices.find(voice => 
      voice.lang === 'en-AU' || voice.lang.startsWith('en-AU')
    ) || voices.find(voice => 
      voice.lang.startsWith('en-')
    ) || voices[0] || null;
  }

  /**
   * Check if speech synthesis is supported
   */
  isSupported(): boolean {
    return this.synthesis !== null;
  }

  /**
   * Update voice settings
   */
  updateSettings(settings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  /**
   * Speak text with current settings.
   *
   * - `'high'` priority: clears the queue and cancels any current speech, then
   *   speaks immediately.
   * - `'low'` priority: appended to the internal queue and spoken in order.
   *   Duplicate instructions already in the queue are silently dropped.
   */
  speak(text: string, priority: 'low' | 'high' = 'low'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis || !this.settings.enabled) {
        resolve();
        return;
      }

      if (priority === 'high') {
        // Drain queue and cancel current speech before speaking
        this._drainQueue();
        this.cancel();
        this.queue.push({ text, priority, resolve, reject });
      } else {
        // Deduplicate: skip if the same text is already waiting
        const alreadyQueued = this.queue.some(item => item.text === text);
        if (alreadyQueued) {
          resolve();
          return;
        }
        this.queue.push({ text, priority, resolve, reject });
      }

      if (!this.isProcessingQueue) {
        this._processQueue();
      }
    });
  }

  /** Immediately speak a single utterance without touching the queue. */
  private _speakNow(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      utterance.volume = this.settings.volume;
      utterance.lang = this.settings.language;

      if (this.voice) {
        utterance.voice = this.voice;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (event) => {
        // Don't treat "interrupted" as an error - it's expected when canceling speech
        if (event.error === 'interrupted' || event.error === 'canceled') {
          console.log('Speech synthesis interrupted/canceled');
          resolve();
        } else {
          console.error('Speech synthesis error:', event);
          reject(event);
        }
      };

      this.synthesis.speak(utterance);
    });
  }

  /** Process queued instructions sequentially. */
  private async _processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      this.onSpeakStartCallback?.(item.text);

      try {
        await this._speakNow(item.text);
        item.resolve();
      } catch (error) {
        item.reject(error);
      }
    }

    this.isProcessingQueue = false;
    this.onSpeakEndCallback?.();
  }

  /** Resolve and remove all pending queue items without speaking them. */
  private _drainQueue() {
    for (const item of this.queue) {
      item.resolve();
    }
    this.queue = [];
  }

  /**
   * Cancel current speech and drain the queue.
   */
  cancel() {
    this._drainQueue();
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.isProcessingQueue = false;
    this.onSpeakEndCallback?.();
  }

  /**
   * Pause speech
   */
  pause() {
    if (this.synthesis && this.synthesis.speaking && !this.synthesis.paused) {
      this.synthesis.pause();
    }
  }

  /**
   * Resume speech
   */
  resume() {
    if (this.synthesis && this.synthesis.paused) {
      this.synthesis.resume();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking || false;
  }

  /**
   * Register a callback invoked when the service begins speaking an utterance.
   * Pass `null` to unregister.
   * Useful for triggering audio ducking on media players.
   */
  onSpeakStart(callback: ((text: string) => void) | null) {
    this.onSpeakStartCallback = callback;
  }

  /**
   * Register a callback invoked when speech ends and the queue is empty.
   * Pass `null` to unregister.
   * Useful for releasing audio ducking after the last instruction.
   */
  onSpeakEnd(callback: (() => void) | null) {
    this.onSpeakEndCallback = callback;
  }
}

// Singleton instance
const voiceService = new VoiceInstructionService();

export { voiceService };

/**
 * Format navigation instruction for voice output
 * Converts text like "Turn left onto Main St" to more natural speech
 */
export function formatInstructionForVoice(instruction: string, distance?: number): string {
  let voiceText = instruction;
  
  // Add distance prefix if provided
  if (distance !== undefined) {
    if (distance < 50) {
      voiceText = `${instruction} now`;
    } else if (distance < 100) {
      voiceText = `In ${Math.round(distance)} meters, ${instruction.toLowerCase()}`;
    } else if (distance < 1000) {
      voiceText = `In ${Math.round(distance / 10) * 10} meters, ${instruction.toLowerCase()}`;
    } else {
      const km = (distance / 1000).toFixed(1);
      voiceText = `In ${km} kilometers, ${instruction.toLowerCase()}`;
    }
  }
  
  return voiceText;
}

/**
 * Generate waypoint arrival announcement
 */
export function announceWaypointArrival(waypointName?: string): string {
  if (waypointName) {
    return `Arriving at ${waypointName}`;
  }
  return 'Arriving at waypoint';
}

/**
 * Generate off-route warning
 */
export function announceOffRoute(): string {
  return 'You are off the planned route. Calculating alternative route.';
}

/**
 * Generate route completion announcement
 */
export function announceRouteComplete(): string {
  return 'You have reached your final destination. Route complete!';
}
