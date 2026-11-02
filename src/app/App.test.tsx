import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the app title as the main heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Certavi' })).toBeInTheDocument();
  });

  it('renders inside a main landmark', () => {
    render(<App />);

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
  });
});
