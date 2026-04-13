import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MobileSplash from './MobileSplash';

describe('MobileSplash', () => {
  it('renders the title and tagline', () => {
    render(<MobileSplash onDone={() => {}} />);
    expect(screen.getByText(/Homework/i)).toBeInTheDocument();
    expect(screen.getByText(/Harbour/i)).toBeInTheDocument();
    expect(screen.getByText(/Your study dock/i)).toBeInTheDocument();
  });

  it('calls onDone when clicked', async () => {
    const onDone = vi.fn();
    render(<MobileSplash onDone={onDone} />);
    
    const splash = screen.getByText(/Your study dock/i).closest('.splash-root');
    fireEvent.click(splash);
    
    // Wait for the exit timeout (500ms)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
    });
    
    expect(onDone).toHaveBeenCalled();
  });

  it('auto-dismisses after 3.5 seconds', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<MobileSplash onDone={onDone} />);
    
    // Advance timers by 3.5s + 0.5s exit animation
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    
    expect(onDone).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
