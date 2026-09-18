import React from 'react';
import { Home, Menu, MessageSquare, MoreHorizontal } from 'lucide-react';
import { plansMembershipCopy } from '../services/subscription';

export function Wordmark({ size = 'md', className = '' }) {
  return (
    <div className={`nb-wordmark nb-wordmark-${size} ${className}`}>
      <span>Homework</span>
      <span className="nb-wordmark-harbour">Harbour</span>
    </div>
  );
}

export function RoleBadge({ role }) {
  if (!role) return null;
  return <span className="nb-role-badge">{role}</span>;
}

export function NbButton({ variant = 'butter', className = '', children, type = 'button', ...props }) {
  return (
    <button type={type} className={`nb-btn nb-btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function NbChip({ tone = 'muted', children, className = '' }) {
  return <span className={`nb-chip nb-chip-${tone} ${className}`}>{children}</span>;
}

export function NbCard({ className = '', as: Tag = 'div', ...props }) {
  return <Tag className={`nb-card ${className}`} {...props} />;
}

export function subjectAvatarTone(subject = '') {
  const s = subject.toLowerCase();
  if (s.includes('math') || s.includes('english')) return 'lilac';
  if (s.includes('sci') || s.includes('art')) return 'sage';
  return 'butter';
}

export function SubjectMark({ subject, size = 40 }) {
  const letter = (subject || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className={`nb-avatar nb-avatar-${subjectAvatarTone(subject)}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {letter}
    </span>
  );
}

export function assignmentStatusChip(assignment, today) {
  const due = assignment?.dueDate;
  const hasGrade = assignment?.grade != null && assignment.grade !== '';
  const done = assignment?.status === 'Completed';
  const submitted = assignment?.status === 'Submitted';
  if (hasGrade || done) return { tone: 'graded', label: 'Graded' };
  if (submitted || assignment?.status === 'In progress') return { tone: 'progress', label: 'In progress' };
  if (due && today && due <= today) return { tone: 'due', label: due === today ? 'Due today' : 'Due today' };
  return { tone: 'progress', label: 'In progress' };
}

export function TopRail({ active = 'home', onMenu, onHome, onChat, onMore }) {
  const items = [
    { key: 'homework', Icon: Menu, onClick: onMenu, label: 'Homework' },
    { key: 'home', Icon: Home, onClick: onHome, label: 'Home' },
    active === 'more'
      ? { key: 'more', Icon: MoreHorizontal, onClick: onMore, label: 'More' }
      : { key: 'chat', Icon: MessageSquare, onClick: onChat, label: 'Chat' },
  ];
  return (
    <div className="nb-top-rail" role="navigation" aria-label="Top">
      {items.map(({ key, Icon, onClick, label }) => (
        <button
          key={key}
          type="button"
          className={`nb-rail-btn ${active === key ? 'is-active' : ''}`}
          onClick={onClick}
          aria-label={label}
          aria-current={active === key ? 'page' : undefined}
        >
          <Icon size={18} strokeWidth={active === key ? 2.6 : 2} />
        </button>
      ))}
    </div>
  );
}

export function PageBand({ tint = 'lilac', children, className = '' }) {
  return <header className={`nb-band nb-band-${tint} ${className}`}>{children}</header>;
}

export function BottomDock({ active, onHome, onHomework, onChat, onMore, overdue = 0, chatUnread = 0 }) {
  const items = [
    { key: 'home', label: 'Home', Icon: Home, onClick: onHome },
    { key: 'homework', label: 'Homework', Icon: Menu, onClick: onHomework, badge: overdue },
    { key: 'chat', label: 'Chat', Icon: MessageSquare, onClick: onChat, badge: chatUnread },
    { key: 'more', label: 'More', Icon: MoreHorizontal, onClick: onMore },
  ];
  return (
    <nav className="nb-dock" aria-label="Primary">
      {items.map(({ key, label, Icon, onClick, badge }) => (
        <button
          key={key}
          type="button"
          className={`nb-dock-item ${active === key ? 'is-active' : ''}`}
          onClick={onClick}
        >
          <span className="nb-dock-icon-wrap">
            <Icon size={20} strokeWidth={active === key ? 2.6 : 2} />
            {badge > 0 && <span className="nb-dock-badge">{badge > 9 ? '9+' : badge}</span>}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function DemoUnlockCard({ onUnlock, unlocking = false, variant = 'chat' }) {
  const isChat = variant === 'chat';
  return (
    <div className={`nb-card nb-demo-card ${isChat ? '' : 'nb-demo-butter'}`}>
      <p className="nb-kicker">Demo unlock</p>
      <p className="nb-demo-copy">
        {isChat
          ? 'Try chat without a paid plan — unlock the demo to message teachers.'
          : 'Explore chat and extras free — no card required for the demo.'}
      </p>
      <NbButton variant={isChat ? 'butter' : 'sage'} onClick={onUnlock} disabled={unlocking}>
        {unlocking ? 'Unlocking...' : 'Unlock demo'}
      </NbButton>
    </div>
  );
}

export function PlansMembershipBanner({ plan, trialEndsAt, now }) {
  const membership = plansMembershipCopy({ plan, trialEndsAt, now });
  return (
    <NbCard className={`p-4 ${membership.kind === 'trial' ? 'bg-sage' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="nb-kicker">{membership.kind === 'trial' ? 'Pro trial' : 'Current Membership'}</p>
          <p className="text-lg font-black">{membership.title}</p>
          <p className="text-sm font-bold mt-2">{membership.subtitle}</p>
        </div>
        {membership.badge && <NbChip tone="graded">{membership.badge}</NbChip>}
      </div>
    </NbCard>
  );
}

export function TrialBanner({ plan, trialEndsAt, now }) {
  const membership = plansMembershipCopy({ plan, trialEndsAt, now });
  if (membership.kind === 'pro' || membership.kind === 'free') return null;
  return <PlansMembershipBanner plan={plan} trialEndsAt={trialEndsAt} now={now} />;
}

export function dockActiveForTab(tab) {
  if (tab === 'Overview') return 'home';
  if (tab === 'Homework') return 'homework';
  if (tab === 'Chat') return 'chat';
  return 'more';
}

export function bandTintForTab(tab, role) {
  if (tab === 'Homework') return 'butter';
  if (tab === 'Payments' || tab === 'Settings') return 'sage';
  if (role === 'Teacher' && tab === 'Overview') return 'butter';
  return 'lilac';
}
