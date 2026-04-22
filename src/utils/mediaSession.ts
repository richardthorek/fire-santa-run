/**
 * Media Session API utilities for lock screen controls
 * Enables control of voice navigation from device lock screen
 *
 * Uses the Media Session API to:
 * - Display route name and current instruction on the lock screen
 * - Provide Play/Pause (voice toggle) and Next/Previous (waypoint skip) controls
 * - Maintain audio focus so voice instructions are prioritised over other media
 */

export interface MediaSessionMetadata {
  routeName: string;
  currentInstruction: string;
}

class MediaSessionService {
  private readonly isSupported: boolean;
  /** Silent HTMLAudioElement used to maintain an active audio session so the OS
   *  grants audio focus and automatically ducks other media (e.g. music) when
   *  speech synthesis plays. */
  private silentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  /** Returns true when the Media Session API is available in this browser. */
  supported(): boolean {
    return this.isSupported;
  }

  /**
   * Initialise a silent looping audio element so the browser considers this
   * page an active media player.  This is required for lock-screen controls to
   * appear and enables audio ducking on mobile OSes.
   *
   * Must be called from a user-gesture handler (e.g. the "start navigation"
   * button press) to satisfy autoplay policies.
   */
  initAudioFocus() {
    if (this.silentAudio) return;

    try {
      // 1-second mono silent WAV encoded as a data URI (44-byte PCM payload, all zeros)
      const silentWav =
        'data:audio/wav;base64,' +
        'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

      const audio = new Audio(silentWav);
      audio.loop = true;
      audio.volume = 0.001; // nearly inaudible – just enough to keep audio session alive

      // play() returns a Promise; ignore errors (e.g. policy blocks in test env)
      audio.play().catch(() => {
        // Autoplay was blocked – the session will be activated on first speech
      });

      this.silentAudio = audio;
    } catch {
      // HTMLAudioElement not available (e.g. jsdom in tests)
    }
  }

  /** Stop and discard the silent audio element (call when navigation ends). */
  releaseAudioFocus() {
    if (!this.silentAudio) return;
    this.silentAudio.pause();
    this.silentAudio.src = '';
    this.silentAudio = null;
  }

  /**
   * Update the metadata shown on the device lock screen / notification shade.
   *
   * @param metadata.routeName - Displayed as the "artist" line
   * @param metadata.currentInstruction - Displayed as the "title" line
   */
  updateMetadata(metadata: MediaSessionMetadata) {
    if (!this.isSupported) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.currentInstruction || 'Navigation Active',
      artist: metadata.routeName,
      album: 'Fire Santa Run Navigation',
      artwork: [
        { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }

  /**
   * Update the playback state indicator on the lock screen.
   *
   * - `'playing'` → voice instructions are active
   * - `'paused'`  → voice muted by the user
   * - `'none'`    → navigation has ended
   */
  setPlaybackState(state: MediaSessionPlaybackState) {
    if (!this.isSupported) return;
    navigator.mediaSession.playbackState = state;
  }

  /**
   * Register lock-screen action handlers.
   * Passing `undefined` for a handler removes that control from the lock screen.
   */
  setActionHandlers({
    onPlay,
    onPause,
    onNextTrack,
    onPreviousTrack,
  }: {
    onPlay?: (() => void) | null;
    onPause?: (() => void) | null;
    onNextTrack?: (() => void) | null;
    onPreviousTrack?: (() => void) | null;
  }) {
    if (!this.isSupported) return;

    navigator.mediaSession.setActionHandler('play', onPlay ?? null);
    navigator.mediaSession.setActionHandler('pause', onPause ?? null);
    navigator.mediaSession.setActionHandler('nexttrack', onNextTrack ?? null);
    navigator.mediaSession.setActionHandler('previoustrack', onPreviousTrack ?? null);
  }

  /** Remove all registered action handlers and reset playback state. */
  clearActionHandlers() {
    if (!this.isSupported) return;

    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);

    navigator.mediaSession.playbackState = 'none';
  }
}

// Singleton – one session per page
const mediaSessionService = new MediaSessionService();

export { mediaSessionService };
