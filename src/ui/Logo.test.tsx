import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('is decoration: hidden from screen readers and not focusable', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg?.querySelector('title')).toBeNull();
  });

  it('is 28 px by default and takes another size', () => {
    const { container, rerender } = render(<Logo />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '28');
    rerender(<Logo size={48} />);
    expect(container.querySelector('svg')).toHaveAttribute('height', '48');
  });
});
