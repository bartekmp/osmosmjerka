import { computeControlBarMode } from '../AdminPanel';

describe('AdminPanel responsive control bar mode', () => {
  it('uses compact mode for narrow layouts', () => {
    expect(computeControlBarMode(480)).toBe('compact');
    expect(computeControlBarMode(1000)).toBe('compact');
  });

  it('switches to short mode for medium layouts', () => {
    expect(computeControlBarMode(1001)).toBe('short');
    expect(computeControlBarMode(1280)).toBe('short');
  });

  it('expands to full mode for wide layouts', () => {
    expect(computeControlBarMode(1281)).toBe('full');
    expect(computeControlBarMode(1920)).toBe('full');
  });
});
