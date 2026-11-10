import { describe, it, expect } from 'vitest';
import { columnsOnly } from './rowColumns';

describe('columnsOnly', () => {
  it('drops the joined rows and keeps the columns', () => {
    const device = { id: 'd1', model: 'iPhone', price: 10, branch: { id: 'b1', name: 'Main' }, supplier: { id: 's1' } };
    expect(columnsOnly(device)).toEqual({ id: 'd1', model: 'iPhone', price: 10 });
    expect(columnsOnly({ status: 'approved', items: [1], from_branch: {}, to_branch: {} })).toEqual({ status: 'approved' });
  });
  it('does not touch the row it was given', () => {
    const row = { a: 1, branch: {} };
    columnsOnly(row);
    expect(row).toHaveProperty('branch');
  });
});
