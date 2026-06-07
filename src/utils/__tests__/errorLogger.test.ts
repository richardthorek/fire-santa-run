import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  logClientError,
  shouldSample,
  installClientErrorReporter,
} from '../errorLogger';

afterEach(() => {
  vi.restoreAllMocks();
  delete window.__onClientError;
});

describe('shouldSample', () => {
  it('always samples at rate >= 1', () => {
    expect(shouldSample(1)).toBe(true);
    expect(shouldSample(2)).toBe(true);
  });

  it('never samples at rate <= 0', () => {
    expect(shouldSample(0)).toBe(false);
    expect(shouldSample(-1)).toBe(false);
  });

  it('samples based on the provided random value', () => {
    expect(shouldSample(0.5, 0.4)).toBe(true);
    expect(shouldSample(0.5, 0.6)).toBe(false);
  });
});

describe('logClientError', () => {
  it('invokes the registered sink with error and context', () => {
    const sink = vi.fn();
    window.__onClientError = sink;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const err = new Error('boom');
    logClientError(err, { source: 'test' });

    expect(sink).toHaveBeenCalledWith(err, expect.objectContaining({ source: 'test' }));
  });

  it('never throws even if the sink throws', () => {
    window.__onClientError = () => {
      throw new Error('listener exploded');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => logClientError(new Error('boom'), { source: 'test' })).not.toThrow();
  });
});

describe('installClientErrorReporter', () => {
  it('POSTs a sampled error report to the backend endpoint', () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    installClientErrorReporter({ endpoint: '/api/client-errors', sampleRate: 1 });
    logClientError(new Error('kaboom'), { source: 'react-error-boundary' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/client-errors');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.message).toBe('kaboom');
    expect(body.source).toBe('react-error-boundary');
  });

  it('does not POST when sampling excludes the error', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    installClientErrorReporter({ sampleRate: 0 });
    logClientError(new Error('dropped'), { source: 'test' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves a pre-existing sink', () => {
    const existing = vi.fn();
    window.__onClientError = existing;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    installClientErrorReporter({ sampleRate: 1 });
    logClientError(new Error('boom'), { source: 'test' });

    expect(existing).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
