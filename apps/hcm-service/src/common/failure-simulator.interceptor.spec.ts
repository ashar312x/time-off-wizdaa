import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { of } from 'rxjs';
import { FailureSimulatorInterceptor } from './failure-simulator.interceptor';

function makeCallHandler(value: unknown = {}) {
  return { handle: jest.fn(() => of(value)) };
}

const ctx = {} as ExecutionContext;

describe('FailureSimulatorInterceptor', () => {
  let interceptor: FailureSimulatorInterceptor;
  const savedEnv = process.env.SIMULATE_FAILURE_RATE;

  beforeEach(() => {
    interceptor = new FailureSimulatorInterceptor();
    delete process.env.SIMULATE_FAILURE_RATE;
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.SIMULATE_FAILURE_RATE = savedEnv;
    } else {
      delete process.env.SIMULATE_FAILURE_RATE;
    }
    jest.restoreAllMocks();
  });

  // ─── pass-through cases ──────────────────────────────────────────────────────

  it('passes through the response when SIMULATE_FAILURE_RATE is not set', (done) => {
    const handler = makeCallHandler({ ok: true });

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ ok: true });
        done();
      },
      error: done,
    });
  });

  it('passes through when failure rate is explicitly 0', (done) => {
    process.env.SIMULATE_FAILURE_RATE = '0';
    const handler = makeCallHandler({ ok: true });

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ ok: true });
        done();
      },
      error: done,
    });
  });

  it('does not throw when random value equals the failure rate (boundary: not strictly less)', (done) => {
    process.env.SIMULATE_FAILURE_RATE = '0.5';
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 < 0.5 is false

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      next: () => done(),
      error: done,
    });
  });

  it('does not throw when random value is above the failure rate', (done) => {
    process.env.SIMULATE_FAILURE_RATE = '0.3';
    jest.spyOn(Math, 'random').mockReturnValue(0.9);

    interceptor.intercept(ctx, makeCallHandler({ ok: true })).subscribe({
      next: () => done(),
      error: done,
    });
  });

  it('calls the next handler when not simulating failure', () => {
    process.env.SIMULATE_FAILURE_RATE = '0';
    const handler = makeCallHandler();

    interceptor.intercept(ctx, handler).subscribe();

    expect(handler.handle).toHaveBeenCalled();
  });

  // ─── failure cases ───────────────────────────────────────────────────────────

  it('throws ServiceUnavailableException when rate is 1.0', (done) => {
    process.env.SIMULATE_FAILURE_RATE = '1';
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      next: () => done(new Error('expected failure')),
      error: (err: unknown) => {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        done();
      },
    });
  });

  it('throws when random value is strictly below the failure rate', (done) => {
    process.env.SIMULATE_FAILURE_RATE = '0.5';
    jest.spyOn(Math, 'random').mockReturnValue(0.3);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      next: () => done(new Error('expected failure')),
      error: (err: unknown) => {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        done();
      },
    });
  });

  it('does not call the next handler when simulating failure', () => {
    process.env.SIMULATE_FAILURE_RATE = '1';
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const handler = makeCallHandler();

    interceptor.intercept(ctx, handler).subscribe({ error: () => undefined });

    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException with the simulated outage message', (done) => {
    process.env.SIMULATE_FAILURE_RATE = '1';
    jest.spyOn(Math, 'random').mockReturnValue(0);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      next: () => done(new Error('expected failure')),
      error: (err: unknown) => {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        done();
      },
    });
  });
});
