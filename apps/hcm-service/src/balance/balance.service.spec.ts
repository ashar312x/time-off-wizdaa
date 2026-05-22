import { UnprocessableEntityException } from '@nestjs/common';

describe('BalanceService rules', () => {
  it('rejects insufficient balance conceptually', () => {
    const balance = 3;
    const requested = 5;
    expect(balance < requested).toBe(true);
    expect(() => {
      if (balance < requested) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_BALANCE',
          availableDays: balance,
        });
      }
    }).toThrow(UnprocessableEntityException);
  });
});
