import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('shows the Spanish label for the status', () => {
    render(<StatusBadge status="INTERVIEWING" />);
    expect(screen.getByText('Entrevistas')).toBeInTheDocument();
  });
});
