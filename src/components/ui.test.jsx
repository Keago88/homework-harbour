import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Wordmark, DemoUnlockCard, BottomDock, assignmentStatusChip } from './ui';
import Chat from './Chat';

describe('neo-brutal primitives', () => {
  it('renders the Homework Harbour wordmark', () => {
    render(<Wordmark />);
    expect(screen.getByText('Homework')).toBeInTheDocument();
    expect(screen.getByText('Harbour')).toBeInTheDocument();
  });

  it('maps assignment status to Figma chip tones', () => {
    expect(assignmentStatusChip({ status: 'Completed', grade: 18 }, '2026-09-18')).toEqual({ tone: 'graded', label: 'Graded' });
    expect(assignmentStatusChip({ status: 'Submitted' }, '2026-09-18')).toEqual({ tone: 'progress', label: 'In progress' });
    expect(assignmentStatusChip({ status: 'Pending', dueDate: '2026-09-18' }, '2026-09-18')).toEqual({ tone: 'due', label: 'Due today' });
  });

  it('bottom dock highlights the active tab', () => {
    render(
      <BottomDock
        active="chat"
        onHome={() => {}}
        onHomework={() => {}}
        onChat={() => {}}
        onMore={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /Chat/i }).className).toMatch(/is-active/);
  });
});

describe('Chat demo unlock chrome', () => {
  it('shows Unlock demo on the locked Chat screen', () => {
    const onUnlock = vi.fn();
    render(
      <Chat
        userEmail="alex@school.edu"
        userName="Alex"
        userRole="Student"
        isPremium={false}
        onUnlockDemo={onUnlock}
      />
    );
    expect(screen.getAllByText(/Unlock demo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Demo unlock/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Unlock demo/i })[0]);
    expect(onUnlock).toHaveBeenCalled();
  });
});
