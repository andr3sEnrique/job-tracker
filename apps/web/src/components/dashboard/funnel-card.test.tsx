import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FunnelCard, conversionRate } from './funnel-card';

describe('conversionRate', () => {
  it('handles zero denominators', () => {
    expect(conversionRate(0, 0)).toBe('0%');
  });

  it('rounds to whole percentages', () => {
    expect(conversionRate(1, 3)).toBe('33%');
  });
});

describe('FunnelCard', () => {
  it('renders each stage with its conversion from the previous one', () => {
    render(<FunnelCard funnel={{ applied: 40, interviewed: 10, offered: 2 }} />);
    expect(screen.getByText('Con entrevista')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
