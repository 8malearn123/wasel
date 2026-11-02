import { describe, it, expect } from 'vitest';
import { amountProblem, productAmountProblem } from './amounts';

describe('amountProblem', () => {
  it('accepts zero and positive values', () => {
    expect(productAmountProblem({ price: 0, cost: 0, quantity: 0 })).toBeNull();
    expect(productAmountProblem({ price: 59.5, cost: 20, quantity: 3 })).toBeNull();
  });
  it('refuses negative price, cost and quantity', () => {
    expect(productAmountProblem({ price: -20 })).toBe('«السعر» لا يمكن أن يكون سالبًا.');
    expect(productAmountProblem({ price: 1, cost: -10 })).toBe('«التكلفة» لا يمكن أن يكون سالبًا.');
    expect(productAmountProblem({ price: 1, cost: 1, quantity: -3 })).toBe('«الكمية» لا يمكن أن يكون سالبًا.');
  });
  it('refuses a fractional quantity and a value that is not a number', () => {
    expect(productAmountProblem({ quantity: 1.5 })).toBe('«الكمية» يجب أن يكون عددًا صحيحًا.');
    expect(productAmountProblem({ price: 'abc' })).toBe('قيمة «السعر» غير صحيحة.');
    expect(productAmountProblem({ price: Infinity })).toBe('قيمة «السعر» غير صحيحة.');
  });
  it('skips fields that are not being saved', () => {
    expect(productAmountProblem({})).toBeNull();
    expect(productAmountProblem({ price: null, cost: undefined, quantity: '' })).toBeNull();
  });
  it('applies min and max', () => {
    expect(amountProblem([{ label: 'الحد الأدنى', value: 0, min: 1 }])).toBe('«الحد الأدنى» يجب ألا يقل عن 1.');
    expect(amountProblem([{ label: 'نسبة الخصم', value: 120, min: 0, max: 100 }])).toBe('«نسبة الخصم» يجب ألا يزيد عن 100.');
    expect(amountProblem([{ label: 'نسبة الخصم', value: 100, max: 100 }])).toBeNull();
  });
});
