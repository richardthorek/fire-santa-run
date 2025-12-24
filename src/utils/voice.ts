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

class VoiceInstructionService {
  private synthesis: SpeechSynthesis | null = null;
  private settings: VoiceSettings = DEFAULT_SETTINGS;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voice: SpeechSynthesisVoice | null = null;

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
   * Speak text with current settings
   */
  speak(text: string, priority: 'low' | 'high' = 'low'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis || !this.settings.enabled) {
        resolve();
        return;
      }

      // Cancel current speech if high priority
      if (priority === 'high' && this.currentUtterance) {
        this.cancel();
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
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        console.error('Speech synthesis error:', event);
        reject(event);
      };

      this.currentUtterance = utterance;
      this.synthesis.speak(utterance);
    });
  }

  /**
   * Cancel current speech
   */
  cancel() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
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
