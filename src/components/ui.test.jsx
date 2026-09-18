import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wordmark, DemoUnlockCard, BottomDock, TrialBanner, assignmentStatusChip } from './ui';
import Chat from './Chat';

describe('neo-brutal primitives', () => {
  it('uses stills neo-brutal tokens, not DIRECTION Clean Light gray/blue', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../theme.css'), 'utf8');
    const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
    expect(root).toMatch(/--nb-ink:\s*#111111/);
    expect(root).toMatch(/--nb-border-w:\s*2\.5px/);
    expect(root).toMatch(/--nb-lilac:\s*#e6d8f5/);
    expect(root).toMatch(/--nb-butter:\s*#f6e7a3/);
    expect(root).not.toMatch(/#E5E7EB/i);
    expect(root).not.toMatch(/#3B82F6/i);
  });

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

  it('shows Unlock demo on the payments card', () => {
    const onUnlock = vi.fn();
    render(<DemoUnlockCard variant="payments" onUnlock={onUnlock} />);
    expect(screen.getByText(/Demo unlock/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Unlock demo/i }));
    expect(onUnlock).toHaveBeenCalled();
  });

  it('unlocked Chat list uses ink chrome, not thin gray', () => {
    render(
      <Chat
        userEmail="alex@school.edu"
        userName="Alex"
        userRole="Student"
        isPremium
      />
    );
    expect(screen.getByText(/^Chats$/)).toBeInTheDocument();
    const search = screen.getByPlaceholderText(/Search conversations/i);
    expect(search.className).toMatch(/border-ink/);
    expect(search.className).not.toMatch(/border-slate-200/);
    fireEvent.click(screen.getByRole('button', { name: /New conversation/i }));
    expect(screen.getByText(/New conversation/i)).toBeInTheDocument();
    const contacts = screen.getByPlaceholderText(/Search contacts/i);
    expect(contacts.className).toMatch(/border-ink/);
    expect(contacts.className).not.toMatch(/border-slate-200/);
  });
});

describe('Pro trial banner', () => {
  it('shows days left while the trial is active', () => {
    const ends = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    render(<TrialBanner plan="free" trialEndsAt={ends} />);
    expect(screen.getByText(/Pro trial — \d+ days? left/)).toBeInTheDocument();
    expect(screen.getByText(/Full Pro is on/i)).toBeInTheDocument();
  });

  it('shows Free after the trial expires', () => {
    render(<TrialBanner plan="free" trialEndsAt="2020-01-01T00:00:00.000Z" />);
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
    expect(screen.getByText(/trial ended/i)).toBeInTheDocument();
  });

  it('hides when plan is pro', () => {
    const ends = new Date(Date.now() + 86400000).toISOString();
    const { container } = render(<TrialBanner plan="pro" trialEndsAt={ends} />);
    expect(container).toBeEmptyDOMElement();
  });
});
