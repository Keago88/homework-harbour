import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from './lib/firebase';
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  BookOpen,
  Calculator,
  Trash2,
  Filter,
  X,
  Settings,
  Home,
  User,
  GraduationCap,
  Users,
  ArrowLeft,
  Mail,
  Lock,
  User as UserIcon,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Camera,
  Check,
  History,
  RefreshCw,
  Flame,
  Zap,
  Target,
  Sparkles,
  MessageSquare,
  TrendingUp,
  BarChart2,
  PieChart,
  Building2,
  Upload,
  Download,
  Search,
  Bell,
  AlertTriangle,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  BellRing,
  CreditCard,
  Wallet
} from 'lucide-react';
import { getSubscriptionStatus, initiateProCheckout, verifyPayment, cancelSubscription } from './services/subscription';
import * as platformData from './lib/platformData';
import { storageGet, storageSet } from './lib/storage';
import { computeRiskScore, getRiskBand } from './lib/riskEngine';
import { computeForecast } from './lib/forecastEngine';
import { checkAlertTriggers, getUnreadAlertsForUser, markAlertRead } from './lib/alerts';
import { createRecoveryTarget, getActiveRecoveryForStudent, getInterventionsForStudent, logTeacherIntervention, updateRecoveryProgress } from './lib/interventions';
import { parseAssignmentsCSV, parseSchoolsCSV } from './lib/csvImport';
import { fetchAllCoursework } from './lib/googleClassroom';
import { getGoogleClassroomToken } from './lib/oauthIntegration';
import MobileSplash from './components/MobileSplash';
import Chat from './components/Chat';

// --- Global Styles & Wallpapers ---
const noScrollbarStyles = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* Dynamic Wallpapers */
  .wallpaper-auth {
    background-image: url('https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=2000&auto=format&fit=crop');
    background-size: cover;
    background-position: center;
  }

  .wallpaper-overview {
    background-image: url('https://images.unsplash.com/photo-1523821741446-edb2b68bb7a0?q=80&w=2000&auto=format&fit=crop');
    background-size: cover;
    background-position: center;
  }

  .wallpaper-planner {
    background-image: url('https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=2000&auto=format&fit=crop');
    background-size: cover;
    background-position: center;
  }
  .wallpaper-planner::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
  }

  .wallpaper-settings {
    background-image: url('https://images.unsplash.com/photo-1614850523060-8da1d56ae167?q=80&w=2000&auto=format&fit=crop');
    background-size: cover;
    background-position: center;
  }

  /* Glassmorphism Utilities */
  .glass-panel {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.4);
  }

  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-blob {
    animation: blob 7s infinite;
  }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
`;

// --- Local auth helpers (demo mode when Firebase not configured) ---
const DEMO_USERS_KEY = 'homework_companion_users';
const PROFILE_STORAGE_KEY = 'homework_companion_profile';
const ANALYTICS_HISTORY_KEY = 'homework_companion_analytics';
const MAX_ANALYTICS_DAYS = 90;

const getCompletionHistory = (userKey) => {
  try {
    const raw = storageGet(ANALYTICS_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const key = userKey || '_default';
    const comp = data[key]?.completions ?? data.completions ?? [];
    return Array.isArray(comp) ? comp : [];
  } catch { return []; }
};

const logCompletion = (assignment, userKey) => {
  try {
    const key = userKey || '_default';
    const raw = storageGet(ANALYTICS_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const byKey = data[key] || { completions: [] };
    byKey.completions = [...(byKey.completions || []), { date: getDate(0), subject: assignment.subject || 'Other', title: assignment.title }].slice(-500);
    data[key] = byKey;
    if (!data._default && key !== '_default') data._default = { completions: [] };
    storageSet(ANALYTICS_HISTORY_KEY, JSON.stringify(data));
  } catch {}
};
const getStoredUsers = () => {
  try {
    const raw = storageGet(DEMO_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const storeUser = (user) => {
  const users = getStoredUsers();
  const existing = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existing >= 0) users[existing] = user;
  else users.push(user);
  storageSet(DEMO_USERS_KEY, JSON.stringify(users));
};
const findUserByCredentials = (email, password) => {
  const users = getStoredUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
};

// --- Configuration ---
const ROLES = { STUDENT: 'Student', PARENT: 'Parent', TEACHER: 'Teacher', ADMIN: 'Admin' };
const TABS = { OVERVIEW: 'Overview', HOMEWORK: 'Homework', ANALYTICS: 'Analytics', CHAT: 'Chat', SCHOOL: 'School', PAYMENTS: 'Payments', SETTINGS: 'Settings' };

const ROLE_COPY = {
  [ROLES.STUDENT]: {
    welcome: 'Welcome back',
    status: 'All set! Ready to learn.',
    navHome: 'Home',
    navHomework: 'My homework',
    navStats: 'My stats',
    navPayments: 'Subscription',
    navSettings: 'Settings',
    homeworkTitle: 'My homework',
    addHomework: 'Add homework',
    addHomeworkModal: 'Add homework',
    assignmentLabel: 'What is it?',
    assignmentPlaceholder: 'e.g. Math problems, Read chapter 3',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'Add any details...',
    homeworkDetails: 'Homework details',
    completeBtn: 'I did it!',
    focusLabel: 'What to do now',
    recentLabel: 'What you did',
    comingUpLabel: 'Coming up',
    allCaughtUp: 'All caught up! 🎉',
    noHomework: 'No homework here.',
    emptyComingUp: 'Nothing due soon.',
    profileTitle: 'Edit profile',
    profileDesc: 'Change your picture and name',
    schoolPlaceholder: 'Your school',
    namePlaceholder: 'Your name',
    studyTimeLabel: 'Study time',
    quickActions: 'Quick actions',
    filterBy: 'Filter by subject',
    noTasks: 'No homework here.',
    analyticsTitle: 'My stats',
    // Filters
    filterOverdue: 'Overdue',
    filterDue: 'Due',
    filterCompleted: 'Completed',
    // Table headers
    colSubject: 'Subject',
    colTask: 'Task',
    colDueDate: 'Due date',
    colStatus: 'Status',
    colPriority: 'Priority',
    // Status labels
    statusDone: 'Done',
    statusLate: 'Late',
    statusOpen: 'Open',
    statusOverdue: 'Overdue',
    statusInProgress: 'In progress',
    statusCompleted: 'Completed',
    // Priority
    priorityHigh: 'High',
    priorityMedium: 'Medium',
    priorityLow: 'Low',
    // Dashboard cards
    cardLate: 'Late',
    cardTodo: 'To do',
    cardDone: 'Done',
    cardOverdueTasks: 'overdue tasks',
    cardTasksTodo: 'tasks to do',
    cardCompleted: 'completed',
    riskTitle: 'Risk score',
    riskLow: 'Low Risk',
    riskModerate: 'Moderate Risk',
    riskHigh: 'High Risk',
    riskCritical: 'Critical Risk',
    alertsTitle: 'Alerts',
    alertsNeedAttention: 'need attention',
    viewAll: 'View all',
    recoveryPlan: 'Recovery plan',
    startRecovery: 'Start recovery',
    forecastTitle: 'Forecast',
    // Stats
    statCompletion: 'Completion',
    statOnTime: 'On-time rate',
    statStreak: 'Streak',
    statThisWeek: 'This week',
    statLastWeek: 'Last week',
    statCompleted: 'completed',
    statDays: 'days',
    statOverdueNow: 'overdue now',
    statAllCaughtUp: 'All caught up',
    statKeepGoing: 'Keep going!',
    statInsights: 'Insights',
    statMostProductive: 'Most productive:',
    statTopSubject: 'Top subject:',
    statDailyAvg: 'Daily avg:',
    statForecast: 'Forecast:',
    statTasksPerDay: 'tasks/day',
    statBySubject: 'By subject',
    statSubjectHealth: 'Subject health',
    statWeeklyCompare: 'Weekly comparison',
    statMoreThanLast: 'more than last week — great progress!',
    statFewerThanLast: 'fewer than last week — let\'s pick it up!',
    statSamePace: 'Same pace as last week — steady!',
    statNoData: 'No data yet',
    statUnlockTrends: 'Add 3 tasks to unlock trends',
    statCompletions: 'Completions',
    // Modals & actions
    addFirstTask: 'Add your first task',
    uploadDoc: 'Upload',
    uploadDocMax: 'Upload document (max 20MB)',
    noDocUploaded: 'No document uploaded.',
    noAttachments: 'No attachments.',
    teacherFeedback: 'Teacher feedback',
    noFeedback: 'No feedback yet.',
    removeBtn: 'Remove',
    openDetails: 'Open full details',
    markDone: 'Mark done',
    exportBtn: 'Export',
    selectedCount: 'selected',
    cancelBtn: 'Cancel',
    addBtn: 'Add',
    // Toasts
    toastAdded: 'Homework added',
    toastRemoved: 'Task removed',
    toastMarkedDone: 'Marked complete',
    toastExported: 'Exported CSV',
    toastDismissed: 'Dismissed',
    toastRecoveryCreated: 'Recovery plan created',
    toastUndone: 'Undone',
    // Settings
    logOut: 'Log out',
    premium: 'Premium',
    premiumDesc: 'Get more features',
    // Search
    searchPlaceholder: 'Search...',
    // Misc
    dueToday: 'Due today',
    dueTomorrow: 'Due tomorrow',
    dueInDays: 'Due in',
    daysLate: 'days late',
    dayLate: 'day late',
    progressLabel: 'Progress',
    notesSection: 'Notes',
    attachments: 'Attachments',
    comments: 'Comments',
    document: 'Document',
    gradeLabel: 'Grade',
    calendarToday: 'Today',
  },
  [ROLES.TEACHER]: {
    welcome: 'Class dashboard',
    status: 'Manage assignments and student progress.',
    navHome: 'Dashboard',
    navHomework: 'Assignments',
    navStats: 'Class analytics',
    navSettings: 'Settings',
    homeworkTitle: 'Assignments',
    addHomework: 'Create assignment',
    addHomeworkModal: 'Create assignment',
    assignmentLabel: 'Assignment title',
    assignmentPlaceholder: 'e.g. Chapter 4 Reading, Lab Report',
    notesLabel: 'Instructions (optional)',
    notesPlaceholder: 'Add instructions for students...',
    homeworkDetails: 'Assignment details',
    completeBtn: 'Mark complete',
    focusLabel: 'Priority task',
    recentLabel: 'Recent activity',
    comingUpLabel: 'Upcoming',
    allCaughtUp: 'All clear.',
    noHomework: 'No assignments yet.',
    emptyComingUp: 'Nothing upcoming.',
    profileTitle: 'Teacher profile',
    profileDesc: 'Update your account',
    schoolPlaceholder: 'School / institution',
    namePlaceholder: 'Your name',
    studyTimeLabel: 'Session time',
    quickActions: 'Quick actions',
    filterBy: 'Filter by subject',
    noTasks: 'No assignments.',
    analyticsTitle: 'Class analytics',
    filterOverdue: 'Overdue', filterDue: 'Due', filterCompleted: 'Completed',
    colSubject: 'Subject', colTask: 'Assignment', colDueDate: 'Due date', colStatus: 'Status', colPriority: 'Priority',
    statusDone: 'Done', statusLate: 'Late', statusOpen: 'Open', statusOverdue: 'Overdue', statusInProgress: 'In progress', statusCompleted: 'Completed',
    priorityHigh: 'High', priorityMedium: 'Medium', priorityLow: 'Low',
    cardLate: 'Late', cardTodo: 'To do', cardDone: 'Done', cardOverdueTasks: 'overdue', cardTasksTodo: 'pending', cardCompleted: 'completed',
    riskTitle: 'Risk score', riskLow: 'Low Risk', riskModerate: 'Moderate Risk', riskHigh: 'High Risk', riskCritical: 'Critical Risk',
    alertsTitle: 'Alerts', alertsNeedAttention: 'need attention', viewAll: 'View all', recoveryPlan: 'Recovery plan', startRecovery: 'Start recovery', forecastTitle: 'Forecast',
    statCompletion: 'Completion', statOnTime: 'On-time rate', statStreak: 'Streak', statThisWeek: 'This week', statLastWeek: 'Last week',
    statCompleted: 'completed', statDays: 'days', statOverdueNow: 'overdue now', statAllCaughtUp: 'All caught up', statKeepGoing: 'Keep going!',
    statInsights: 'Insights', statMostProductive: 'Most productive:', statTopSubject: 'Top subject:', statDailyAvg: 'Daily avg:', statForecast: 'Forecast:',
    statTasksPerDay: 'tasks/day', statBySubject: 'By subject', statSubjectHealth: 'Subject health', statWeeklyCompare: 'Weekly comparison',
    statMoreThanLast: 'more than last week — great progress!', statFewerThanLast: 'fewer than last week', statSamePace: 'Same pace — steady!',
    statNoData: 'No data yet', statUnlockTrends: 'Add 3 tasks to unlock trends', statCompletions: 'Completions',
    addFirstTask: 'Create first assignment', uploadDoc: 'Upload', uploadDocMax: 'Upload document (max 20MB)', noDocUploaded: 'No document uploaded.', noAttachments: 'No attachments.',
    teacherFeedback: 'My feedback', noFeedback: 'No feedback yet.', removeBtn: 'Remove', openDetails: 'Open full details', markDone: 'Mark done', exportBtn: 'Export',
    selectedCount: 'selected', cancelBtn: 'Cancel', addBtn: 'Create',
    toastAdded: 'Assignment created', toastRemoved: 'Assignment removed', toastMarkedDone: 'Marked complete', toastExported: 'Exported CSV',
    toastDismissed: 'Dismissed', toastRecoveryCreated: 'Recovery plan created', toastUndone: 'Undone',
    logOut: 'Log out', premium: 'Premium', premiumDesc: 'Upgrade your plan', searchPlaceholder: 'Search...',
    dueToday: 'Due today', dueTomorrow: 'Due tomorrow', dueInDays: 'Due in', daysLate: 'days late', dayLate: 'day late',
    progressLabel: 'Progress', notesSection: 'Notes', attachments: 'Attachments', comments: 'Comments', document: 'Document', gradeLabel: 'Grade', calendarToday: 'Today',
  },
  [ROLES.PARENT]: {
    welcome: 'Your child\'s progress',
    status: 'Track progress and support learning.',
    navHome: 'Overview',
    navHomework: 'Child\'s homework',
    navStats: 'Progress & stats',
    navPayments: 'Subscription',
    navSettings: 'Settings',
    homeworkTitle: 'Assignments',
    addHomework: 'Add task',
    addHomeworkModal: 'Add task',
    assignmentLabel: 'Task title',
    assignmentPlaceholder: 'e.g. Practice spelling',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'Any notes...',
    homeworkDetails: 'Assignment details',
    completeBtn: 'Mark done',
    focusLabel: 'Current focus',
    recentLabel: 'Recent activity',
    comingUpLabel: 'Coming up',
    allCaughtUp: 'All done! 🎉',
    noHomework: 'No assignments.',
    emptyComingUp: 'Nothing due soon.',
    profileTitle: 'Parent profile',
    profileDesc: 'Update your account',
    schoolPlaceholder: 'School (optional)',
    namePlaceholder: 'Your name',
    studyTimeLabel: 'Session',
    quickActions: 'Actions',
    filterBy: 'Filter by subject',
    noTasks: 'No assignments.',
    analyticsTitle: 'Progress & stats',
    filterOverdue: 'Overdue', filterDue: 'Due', filterCompleted: 'Completed',
    colSubject: 'Subject', colTask: 'Task', colDueDate: 'Due date', colStatus: 'Status', colPriority: 'Priority',
    statusDone: 'Done', statusLate: 'Late', statusOpen: 'Open', statusOverdue: 'Overdue', statusInProgress: 'In progress', statusCompleted: 'Completed',
    priorityHigh: 'High', priorityMedium: 'Medium', priorityLow: 'Low',
    cardLate: 'Late', cardTodo: 'To do', cardDone: 'Done', cardOverdueTasks: 'overdue', cardTasksTodo: 'to do', cardCompleted: 'completed',
    riskTitle: 'Risk score', riskLow: 'Low Risk', riskModerate: 'Moderate Risk', riskHigh: 'High Risk', riskCritical: 'Critical Risk',
    alertsTitle: 'Alerts', alertsNeedAttention: 'need attention', viewAll: 'View all', recoveryPlan: 'Recovery plan', startRecovery: 'Start recovery', forecastTitle: 'Forecast',
    statCompletion: 'Completion', statOnTime: 'On-time rate', statStreak: 'Streak', statThisWeek: 'This week', statLastWeek: 'Last week',
    statCompleted: 'completed', statDays: 'days', statOverdueNow: 'overdue now', statAllCaughtUp: 'All caught up', statKeepGoing: 'Keep going!',
    statInsights: 'Insights', statMostProductive: 'Most productive:', statTopSubject: 'Top subject:', statDailyAvg: 'Daily avg:', statForecast: 'Forecast:',
    statTasksPerDay: 'tasks/day', statBySubject: 'By subject', statSubjectHealth: 'Subject health', statWeeklyCompare: 'Weekly comparison',
    statMoreThanLast: 'more than last week — great progress!', statFewerThanLast: 'fewer than last week', statSamePace: 'Same pace — steady!',
    statNoData: 'No data yet', statUnlockTrends: 'Add 3 tasks to see trends', statCompletions: 'Completions',
    addFirstTask: 'Add first task', uploadDoc: 'Upload', uploadDocMax: 'Upload document (max 20MB)', noDocUploaded: 'No document uploaded.', noAttachments: 'No attachments.',
    teacherFeedback: 'Teacher feedback', noFeedback: 'No feedback yet.', removeBtn: 'Remove', openDetails: 'Open full details', markDone: 'Mark done', exportBtn: 'Export',
    selectedCount: 'selected', cancelBtn: 'Cancel', addBtn: 'Add',
    toastAdded: 'Task added', toastRemoved: 'Task removed', toastMarkedDone: 'Marked complete', toastExported: 'Exported CSV',
    toastDismissed: 'Dismissed', toastRecoveryCreated: 'Recovery plan created', toastUndone: 'Undone',
    logOut: 'Log out', premium: 'Premium', premiumDesc: 'Get more features', searchPlaceholder: 'Search...',
    dueToday: 'Due today', dueTomorrow: 'Due tomorrow', dueInDays: 'Due in', daysLate: 'days late', dayLate: 'day late',
    progressLabel: 'Progress', notesSection: 'Notes', attachments: 'Attachments', comments: 'Comments', document: 'Document', gradeLabel: 'Grade', calendarToday: 'Today',
  },
  [ROLES.ADMIN]: {
    welcome: 'School admin',
    status: 'Manage your school.',
    navHome: 'Dashboard',
    navHomework: 'Assignments',
    navStats: 'Analytics',
    navPayments: 'Subscription',
    navSettings: 'Settings',
    analyticsTitle: 'Platform Analytics',
    exportBtn: 'Export',
    toastExported: 'Exported CSV',
    profileTitle: 'Admin profile',
    profileDesc: 'Account settings',
    schoolPlaceholder: 'School name',
    namePlaceholder: 'Name',
    logOut: 'Log out',
  },
};
const GRADE_OVERRIDES = {
  junior: {
    // Nav
    welcome: 'Hi there!',
    status: 'Let\'s see what we need to do today!',
    navHome: 'Home',
    navHomework: 'My work',
    navStats: 'How I\'m doing',
    navPayments: 'Subscription',
    navSettings: 'Settings',
    // Homework
    homeworkTitle: 'My work',
    addHomework: 'Add work',
    addHomeworkModal: 'Add new work',
    assignmentLabel: 'What do you need to do?',
    assignmentPlaceholder: 'Like: Read a story, Do sums',
    notesLabel: 'Extra info',
    notesPlaceholder: 'Write anything else here...',
    homeworkDetails: 'Work details',
    completeBtn: 'Done!',
    noHomework: 'Nothing here yet.',
    noTasks: 'No work to show.',
    filterBy: 'Pick a subject',
    // Filters
    filterOverdue: 'Not done',
    filterDue: 'To do',
    filterCompleted: 'Finished',
    // Table headers
    colSubject: 'Subject',
    colTask: 'What',
    colDueDate: 'When',
    colStatus: 'Done?',
    colPriority: 'Important?',
    // Status labels
    statusDone: 'Finished',
    statusLate: 'Not done',
    statusOpen: 'To do',
    statusOverdue: 'Late',
    statusInProgress: 'Doing it',
    statusCompleted: 'Finished',
    // Priority
    priorityHigh: 'Very important',
    priorityMedium: 'Important',
    priorityLow: 'Not urgent',
    // Dashboard
    focusLabel: 'Do this first',
    recentLabel: 'What you finished',
    comingUpLabel: 'What\'s next',
    allCaughtUp: 'All done! Well done!',
    emptyComingUp: 'Nothing coming up.',
    quickActions: 'Things I can do',
    cardLate: 'Not done yet',
    cardTodo: 'Still to do',
    cardDone: 'Finished',
    cardOverdueTasks: 'not done',
    cardTasksTodo: 'things to do',
    cardCompleted: 'finished',
    riskTitle: 'How am I doing?',
    riskLow: 'Doing great!',
    riskModerate: 'Doing okay',
    riskHigh: 'Need some help',
    riskCritical: 'Let\'s catch up!',
    alertsTitle: 'Things to know',
    alertsNeedAttention: 'need attention',
    viewAll: 'See all',
    recoveryPlan: 'Catch-up plan',
    startRecovery: 'Start catching up',
    forecastTitle: 'What\'s coming',
    // Stats
    analyticsTitle: 'How am I doing?',
    statCompletion: 'Done',
    statOnTime: 'On time',
    statStreak: 'In a row',
    statThisWeek: 'This week',
    statLastWeek: 'Last week',
    statCompleted: 'finished',
    statDays: 'days',
    statOverdueNow: 'not done yet',
    statAllCaughtUp: 'All done!',
    statKeepGoing: 'Keep going!',
    statInsights: 'Fun facts',
    statMostProductive: 'Best day:',
    statTopSubject: 'Best subject:',
    statDailyAvg: 'Each day:',
    statForecast: 'Looking ahead:',
    statTasksPerDay: 'things/day',
    statBySubject: 'By subject',
    statSubjectHealth: 'How each subject is going',
    statWeeklyCompare: 'This week vs last week',
    statMoreThanLast: 'more than last week — well done!',
    statFewerThanLast: 'fewer than last week — let\'s try harder!',
    statSamePace: 'Same as last week — nice and steady!',
    statNoData: 'Nothing yet',
    statUnlockTrends: 'Do 3 things to see how you\'re doing',
    statCompletions: 'Things I finished',
    // Modals & actions
    addFirstTask: 'Add your first thing to do',
    uploadDoc: 'Add a file',
    uploadDocMax: 'Add a file (not too big!)',
    noDocUploaded: 'No file added yet.',
    noAttachments: 'No files.',
    teacherFeedback: 'What teacher said',
    noFeedback: 'Nothing from teacher yet.',
    removeBtn: 'Take away',
    openDetails: 'See more',
    markDone: 'Finished!',
    exportBtn: 'Save list',
    selectedCount: 'picked',
    cancelBtn: 'Never mind',
    addBtn: 'Add it',
    // Toasts
    toastAdded: 'Added!',
    toastRemoved: 'Taken away',
    toastMarkedDone: 'Well done!',
    toastExported: 'List saved!',
    toastDismissed: 'Got it!',
    toastRecoveryCreated: 'Catch-up plan started!',
    toastUndone: 'Put it back!',
    // Settings
    profileTitle: 'About me',
    profileDesc: 'Change your picture and name',
    schoolPlaceholder: 'My school',
    namePlaceholder: 'My name',
    studyTimeLabel: 'Study time',
    logOut: 'Log out',
    premium: 'Get more',
    premiumDesc: 'Unlock cool stuff',
    // Calendar
    calendarToday: 'Today',
    // Search
    searchPlaceholder: 'Find something...',
    // Misc
    dueToday: 'Do today',
    dueTomorrow: 'Do tomorrow',
    dueInDays: 'Do in',
    daysLate: 'days late',
    dayLate: 'day late',
    progressLabel: 'How far',
    notesSection: 'Notes',
    attachments: 'Files',
    comments: 'Teacher notes',
    document: 'My file',
    gradeLabel: 'Mark',
  },
  middle: {
    // Nav
    welcome: 'Welcome back',
    navHomework: 'My homework',
    navStats: 'My progress',
    // Homework
    completeBtn: 'Mark as done',
    assignmentPlaceholder: 'e.g. Math worksheet, Read chapter 2',
    // Filters
    filterOverdue: 'Overdue',
    filterDue: 'Due',
    filterCompleted: 'Completed',
    // Table headers
    colSubject: 'Subject',
    colTask: 'Task',
    colDueDate: 'Due date',
    colStatus: 'Status',
    colPriority: 'Priority',
    // Status
    statusDone: 'Done',
    statusLate: 'Late',
    statusOpen: 'Open',
    statusOverdue: 'Overdue',
    statusInProgress: 'In progress',
    statusCompleted: 'Completed',
    // Priority
    priorityHigh: 'High',
    priorityMedium: 'Medium',
    priorityLow: 'Low',
    // Dashboard
    cardLate: 'Late',
    cardTodo: 'To do',
    cardDone: 'Done',
    cardOverdueTasks: 'overdue',
    cardTasksTodo: 'to do',
    cardCompleted: 'done',
    riskTitle: 'Risk score',
    riskLow: 'Low risk',
    riskModerate: 'Moderate risk',
    riskHigh: 'High risk',
    riskCritical: 'Critical risk',
    alertsTitle: 'Alerts',
    alertsNeedAttention: 'need attention',
    viewAll: 'View all',
    recoveryPlan: 'Recovery plan',
    startRecovery: 'Start recovery',
    // Stats
    analyticsTitle: 'My progress',
    statCompletion: 'Completion',
    statOnTime: 'On-time rate',
    statStreak: 'Streak',
    statThisWeek: 'This week',
    statLastWeek: 'Last week',
    statCompleted: 'completed',
    statDays: 'days',
    statOverdueNow: 'overdue now',
    statAllCaughtUp: 'All caught up',
    statKeepGoing: 'Keep going!',
    statInsights: 'Insights',
    statMostProductive: 'Best day:',
    statTopSubject: 'Top subject:',
    statDailyAvg: 'Daily avg:',
    statForecast: 'Forecast:',
    statTasksPerDay: 'tasks/day',
    statBySubject: 'By subject',
    statSubjectHealth: 'Subject health',
    statWeeklyCompare: 'Weekly comparison',
    statMoreThanLast: 'more than last week — nice work!',
    statFewerThanLast: 'fewer than last week — let\'s pick it up!',
    statSamePace: 'Same pace as last week — steady!',
    statNoData: 'No data yet',
    statUnlockTrends: 'Add 3 tasks to see your progress',
    statCompletions: 'Completions',
    // Modals
    addFirstTask: 'Add your first task',
    uploadDoc: 'Upload document',
    uploadDocMax: 'Upload document (max 20MB)',
    noDocUploaded: 'No document uploaded.',
    noAttachments: 'No attachments.',
    teacherFeedback: 'Teacher feedback',
    noFeedback: 'No feedback yet.',
    removeBtn: 'Remove',
    openDetails: 'Open full details',
    markDone: 'Mark done',
    exportBtn: 'Export',
    selectedCount: 'selected',
    cancelBtn: 'Cancel',
    addBtn: 'Add',
    // Toasts
    toastAdded: 'Homework added',
    toastRemoved: 'Task removed',
    toastMarkedDone: 'Marked complete',
    toastExported: 'Exported CSV',
    toastDismissed: 'Dismissed',
    toastRecoveryCreated: 'Recovery plan created',
    toastUndone: 'Undone',
    // Settings
    logOut: 'Log out',
    premium: 'Premium',
    premiumDesc: 'Get more features',
    // Search
    searchPlaceholder: 'Search...',
    // Misc
    dueToday: 'Due today',
    dueTomorrow: 'Due tomorrow',
    dueInDays: 'Due in',
    daysLate: 'days late',
    dayLate: 'day late',
    progressLabel: 'Progress',
    notesSection: 'Notes',
    attachments: 'Attachments',
    comments: 'Comments',
    document: 'Document',
    gradeLabel: 'Grade',
  },
};
const getGradeBand = (grade) => {
  const g = parseInt(grade, 10);
  if (isNaN(g) || g < 1) return 'senior';
  if (g <= 3) return 'junior';
  if (g <= 7) return 'middle';
  return 'senior';
};
const getCopy = (role, grade) => {
  const base = ROLE_COPY[role] || ROLE_COPY[ROLES.STUDENT];
  if (role !== ROLES.STUDENT) return base;
  const band = getGradeBand(grade);
  if (band === 'senior') return base;
  return { ...base, ...(GRADE_OVERRIDES[band] || {}) };
};
const HW_FILTERS = { OVERDUE: 'Overdue', DUE: 'Due', COMPLETED: 'Completed' };
const DEFAULT_SUBJECTS = ['Math', 'Science', 'History', 'English', 'Art', 'Coding'];

const getDate = (daysOffset) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

const ASSIGNMENTS_STORAGE_KEY = 'hwc_assignments';
const getStoredAssignments = (userKey) => {
  try {
    const raw = storageGet(ASSIGNMENTS_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data[userKey] || null;
  } catch { return null; }
};
const saveStoredAssignments = (userKey, list) => {
  try {
    const raw = storageGet(ASSIGNMENTS_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[userKey] = list;
    storageSet(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(data));
  } catch {}
};

const INITIAL_ASSIGNMENTS = [];

const getAssignmentProgress = (a) => (a.status === 'Completed' || a.status === 'Submitted') ? 100 : (a.progress ?? 0);

const SUBSCRIPTION_PLANS = [
  {
    id: 'free', name: 'Free', price: 0, badge: null, popular: false,
    tagline: 'Get started with the basics',
    features: [
      { text: '1 student profile', included: true },
      { text: 'Task tracking & calendar', included: true },
      { text: '100 MB file storage', included: true },
      { text: 'Basic completion stats', included: true },
      { text: 'Risk score & alerts', included: false },
      { text: 'CSV import / export', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Priority support', included: false },
    ]
  },
  {
    id: 'pro', name: 'Pro', price: 199, badge: 'Most popular', popular: true,
    tagline: 'Everything you need to stay ahead',
    features: [
      { text: '1 student profile', included: true },
      { text: 'Task tracking & calendar', included: true },
      { text: '15 GB file storage', included: true },
      { text: 'Basic completion stats', included: true },
      { text: 'Risk score & alerts', included: true },
      { text: 'CSV import / export', included: true },
      { text: 'Advanced analytics & trends', included: true },
      { text: 'Priority support', included: true },
    ]
  }
];

// --- Helper Components ---
const AuthScreen = ({ onLogin, isLoading, useFirebase }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: ROLES.STUDENT, stayLoggedIn: true });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const setAuthPersistence = async () => {
    if (!auth) return;
    await setPersistence(auth, formData.stayLoggedIn ? browserLocalPersistence : browserSessionPersistence);
  };

  const handleGoogleSignIn = async () => {
    if (!useFirebase || !auth) return;
    setError("");
    setSubmitting(true);
    try {
      await setAuthPersistence();
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
      provider.addScope('https://www.googleapis.com/auth/classroom.coursework.me.readonly');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const stored = getStoredUsers().find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
      const role = stored?.role || formData.role || ROLES.STUDENT;
      if (!stored) storeUser({ email: user.email, name: user.displayName || user.email?.split('@')[0] || 'User', role });
      onLogin({ name: user.displayName || user.email?.split('@')[0] || 'User', role, email: user.email });
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        try {
          sessionStorage.setItem('hwc_google_signup_role', formData.role);
          const redirectProvider = new GoogleAuthProvider();
          redirectProvider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
          redirectProvider.addScope('https://www.googleapis.com/auth/classroom.coursework.me.readonly');
          await signInWithRedirect(auth, redirectProvider);
          return;
        } catch (redirectErr) {
          setError(redirectErr?.message || 'Google sign-in failed');
        }
      } else {
        setError(err?.message || 'Google sign-in failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email?.trim()) {
      setError('Enter your email to reset password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (useFirebase && auth) {
        await sendPasswordResetEmail(auth, formData.email.trim());
        setForgotSuccess(true);
      } else {
        setError('Password reset requires Firebase. Sign in with your password or create an account.');
      }
    } catch (err) {
      setError(err?.message || 'Could not send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignUp) {
        if (!formData.name?.trim() || !formData.email?.trim() || !formData.password?.trim()) {
          setError("Please fill in all fields.");
          return;
        }
        if (formData.password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        if (useFirebase && auth) {
          await setAuthPersistence();
          const { user } = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
          storeUser({ email: formData.email.trim(), name: formData.name.trim(), role: formData.role, uid: user.uid });
          onLogin({ name: formData.name.trim(), role: formData.role, email: formData.email.trim() });
        } else {
          const users = getStoredUsers();
          if (users.some(u => u.email.toLowerCase() === formData.email.trim().toLowerCase())) {
            setError("An account with this email already exists. Sign in instead.");
            return;
          }
          storeUser({ email: formData.email.trim(), password: formData.password, name: formData.name.trim(), role: formData.role });
          onLogin({ name: formData.name.trim(), role: formData.role, email: formData.email.trim() });
        }
      } else {
        if (!formData.email?.trim() || !formData.password?.trim()) {
          setError("Please enter your email and password.");
          return;
        }
        if (useFirebase && auth) {
          await setAuthPersistence();
          await signInWithEmailAndPassword(auth, formData.email.trim(), formData.password);
          const stored = getStoredUsers().find(u => u.email?.toLowerCase() === formData.email.trim().toLowerCase());
          onLogin({ name: stored?.name || "User", role: stored?.role || ROLES.STUDENT, email: stored?.email });
        } else {
          const found = findUserByCredentials(formData.email.trim(), formData.password);
          if (!found) {
            setError("Invalid email or password.");
            return;
          }
          onLogin({ name: found.name, role: found.role, email: found.email });
        }
      }
    } catch (err) {
      const msg = err?.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' :
        err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' ? 'Invalid email or password.' :
        err?.message || 'Something went wrong.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen wallpaper-auth flex items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden text-slate-800 transition-all duration-700">
      <style>{noScrollbarStyles}</style>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-20 right-20 w-32 h-32 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-48 h-48 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="glass-panel rounded-[32px] shadow-2xl relative w-full max-w-[800px] min-h-[550px] flex shrink-0 z-10 my-8 overflow-hidden">
        {/* Sign-up form - slides from left to right when active; on mobile stays centered (no right panel) */}
        <div className={`absolute inset-y-0 left-0 w-full md:w-1/2 flex flex-col items-center justify-center p-8 transition-all duration-700 ease-in-out z-20 ${isSignUp ? 'translate-x-0 md:translate-x-[100%] opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>
          <form className="w-full space-y-4" onSubmit={handleSubmit}>
            {useFirebase && auth && (
              <>
                <button type="button" onClick={handleGoogleSignIn} disabled={isLoading || submitting} className="w-full py-3.5 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 bg-white/50">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign up with Google
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">or</span><div className="flex-1 h-px bg-slate-200" />
                </div>
              </>
            )}
            <div className="bg-white/50 border border-white p-3 rounded-2xl flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-violet-400 transition-all">
              <UserIcon size={18} className="text-violet-400" />
              <input type="text" placeholder="First Name" className="bg-transparent outline-none flex-1 text-sm font-bold text-slate-700 placeholder:text-slate-400" value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} required />
            </div>
            <div className="w-full">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">I am a</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[ROLES.STUDENT, ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN].map(r => (
                  <button key={r} type="button" onClick={() => setFormData(prev => ({...prev, role: r}))} className={`flex items-center justify-center min-h-[44px] py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider border-2 transition-all shadow-sm w-full ${formData.role === r ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-transparent bg-white/50 text-slate-400 hover:bg-white'}`}>{r}</button>
                ))}
              </div>
            </div>
            <div className="bg-white/50 border border-white p-3 rounded-2xl flex items-center gap-3 shadow-sm">
              <Mail size={18} className="text-violet-400" />
              <input type="email" placeholder="Email Address" className="bg-transparent outline-none flex-1 text-sm font-medium" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} required />
            </div>
            <div className="bg-white/50 border border-white p-3 rounded-2xl flex items-center gap-3 shadow-sm">
              <Lock size={18} className="text-violet-400" />
              <input type="password" placeholder="Password (at least 6 letters)" className="bg-transparent outline-none flex-1 text-sm font-medium" value={formData.password} onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))} required minLength={6} />
            </div>
            {useFirebase && auth && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={formData.stayLoggedIn} onChange={(e) => setFormData(prev => ({...prev, stayLoggedIn: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-400 accent-violet-500" />
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">Stay logged in</span>
              </label>
            )}
            {error && <p className="text-rose-600 text-xs font-bold">{error}</p>}
            <button type="submit" disabled={isLoading || submitting} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-xs mt-2 disabled:opacity-50 transition-all hover:scale-[1.02] shadow-lg shadow-violet-200">
              {submitting ? 'Creating...' : 'Create account'}
            </button>
          </form>
          <button type="button" onClick={() => { setIsSignUp(false); setError(""); }} className="text-xs font-bold text-violet-400 hover:text-violet-600 mt-6 transition-colors">Already have an account? Sign in</button>
        </div>

        {/* Sign-in form - on left when active, slides out when sign-up active */}
        <div className={`absolute inset-y-0 left-0 w-full md:w-1/2 flex flex-col items-center justify-center p-8 transition-all duration-700 ease-in-out z-20 ${isSignUp ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}>
          {showForgotPassword ? (
            <>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-600 mb-2">Reset password</h1>
              <p className="text-xs text-slate-500 mb-6 font-medium">Enter your email and we&apos;ll send a reset link.</p>
              {forgotSuccess ? (
                <div className="w-full space-y-4">
                  <p className="text-emerald-600 text-sm font-bold">Check your email for the reset link.</p>
                  <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); setError(""); }} className="text-xs font-bold text-violet-400 hover:text-violet-600 transition-colors">Back to sign in</button>
                </div>
              ) : (
                <form className="w-full space-y-4" onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }}>
                  <div className="bg-white/50 border border-white p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                    <Mail size={18} className="text-violet-400" />
                    <input type="email" placeholder="Email" className="bg-transparent outline-none flex-1 text-sm font-medium" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} required />
                  </div>
                  {error && <p className="text-rose-600 text-xs font-bold">{error}</p>}
                  <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-xs disabled:opacity-50 transition-all hover:scale-[1.02] shadow-lg shadow-violet-200">
                    {submitting ? 'Sending...' : 'Send reset link'}
                  </button>
                  <button type="button" onClick={() => { setShowForgotPassword(false); setError(""); }} className="text-xs font-bold text-violet-400 hover:text-violet-600 transition-colors">Back to sign in</button>
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-600 mb-2">Welcome back</h1>
              <p className="text-xs text-slate-500 mb-6 font-medium">Sign in to keep going.</p>
              <form className="w-full space-y-4" onSubmit={handleSubmit}>
                {useFirebase && auth && (
                  <>
                    <button type="button" onClick={handleGoogleSignIn} disabled={isLoading || submitting} className="w-full py-3.5 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 bg-white/50">
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Continue with Google
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-slate-200" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">or</span><div className="flex-1 h-px bg-slate-200" />
                    </div>
                  </>
                )}
                <div className="bg-white/50 border border-white p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                  <Mail size={18} className="text-violet-400" />
                  <input type="email" placeholder="Email" className="bg-transparent outline-none flex-1 text-sm font-medium" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} required />
                </div>
                <div>
                  <div className="bg-white/50 border border-white p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                    <Lock size={18} className="text-violet-400" />
                    <input type="password" placeholder="Password" className="bg-transparent outline-none flex-1 text-sm font-medium" value={formData.password} onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))} required />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {useFirebase && auth ? (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={formData.stayLoggedIn} onChange={(e) => setFormData(prev => ({...prev, stayLoggedIn: e.target.checked}))} className="w-4 h-4 rounded border-slate-300 text-violet-500 focus:ring-violet-400 accent-violet-500" />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">Stay logged in</span>
                      </label>
                    ) : <span />}
                    <button type="button" onClick={() => { setShowForgotPassword(true); setError(""); }} className="text-xs font-medium text-violet-500 hover:text-violet-600 transition-colors">Forgot password?</button>
                  </div>
                </div>
                {error && <p className="text-rose-600 text-xs font-bold">{error}</p>}
                <button type="submit" disabled={isLoading || submitting} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-xs mt-2 disabled:opacity-50 transition-all hover:scale-[1.02] shadow-lg shadow-violet-200">
                  {submitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              <p className="text-[10px] text-slate-400 mt-4">Secure login • POPIA-aligned</p>
              <button type="button" onClick={() => { setIsSignUp(true); setError(""); setShowForgotPassword(false); setForgotSuccess(false); }} className="text-xs font-bold text-violet-400 hover:text-violet-600 mt-4 transition-colors">New here? Create account</button>
            </>
          )}
        </div>

        {/* Gradient overlay - on right when sign-in, slides left when sign-up; hidden on mobile for app-like feel */}
        <div className={`absolute inset-y-0 right-0 w-1/2 overflow-hidden transition-transform duration-700 ease-in-out z-10 hidden md:block ${isSignUp ? '-translate-x-full' : 'translate-x-0'}`}>
          <div className={`absolute inset-0 w-[200%] flex transition-transform duration-700 ease-in-out ${isSignUp ? 'translate-x-0' : '-translate-x-1/2'}`}>
            <div className="w-1/2 h-full bg-gradient-to-br from-violet-600 to-fuchsia-700 flex flex-col items-center justify-center px-12 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm"><Sparkles size={40} className="text-yellow-300" /></div>
              <h2 className="text-3xl font-black text-white mb-3">Hello!</h2>
              <p className="text-white/90 text-sm mb-8 leading-relaxed">Put in your name and make an account to start.</p>
              <button type="button" onClick={() => { setIsSignUp(false); setError(""); setShowForgotPassword(false); setForgotSuccess(false); }} className="border-2 border-white/50 bg-white/10 backdrop-blur-md text-white px-10 py-3 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-white hover:text-violet-600 transition-all">Sign in</button>
            </div>
            <div className="w-1/2 h-full bg-gradient-to-br from-violet-600 to-fuchsia-700 flex flex-col items-center justify-center px-12 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm"><Target size={40} className="text-cyan-300" /></div>
              <h2 className="text-3xl font-black text-white mb-3">Welcome back!</h2>
              <p className="text-white/90 text-sm mb-8 leading-relaxed">Sign in with your email and password.</p>
              <button type="button" onClick={() => { setIsSignUp(true); setError(""); setShowForgotPassword(false); setForgotSuccess(false); }} className="border-2 border-white/50 bg-white/10 backdrop-blur-md text-white px-10 py-3 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-white hover:text-violet-600 transition-all">Sign up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SchoolDashboard = ({ schools, search = '', onRefresh, confirm }) => {
  const [newSchoolName, setNewSchoolName] = useState('');
  const [addTeacherFor, setAddTeacherFor] = useState(null);
  const [addClassFor, setAddClassFor] = useState(null);
  const [teacherForm, setTeacherForm] = useState({ email: '', name: '' });
  const [classForm, setClassForm] = useState({ name: '', teacherEmail: '' });
  const filteredSchools = !search?.trim() ? schools : schools.filter(s => s.name.toLowerCase().includes(search.toLowerCase().trim()));

  const handleRemoveSchool = (school) => {
    if (!confirm) { platformData.removeSchool(school.id, schools); onRefresh?.(); return; }
    confirm(`Remove school "${school.name}"? This cannot be undone.`, () => { platformData.removeSchool(school.id, schools); onRefresh?.(); }, 'danger');
  };

  const handleRemoveTeacher = (school, teacherEmail) => {
    if (!confirm) { platformData.removeTeacherFromSchool(school.id, teacherEmail, schools); onRefresh?.(); return; }
    confirm(`Remove this teacher from ${school.name}?`, () => { platformData.removeTeacherFromSchool(school.id, teacherEmail, schools); onRefresh?.(); }, 'danger');
  };

  const handleCreate = () => {
    if (!newSchoolName.trim()) return;
    if (!confirm) { platformData.createSchool(newSchoolName.trim(), 'admin@school.com', schools); setNewSchoolName(''); onRefresh?.(); return; }
    confirm(`Create school "${newSchoolName.trim()}"?`, () => { platformData.createSchool(newSchoolName.trim(), 'admin@school.com', schools); setNewSchoolName(''); onRefresh?.(); });
  };

  const handleAddTeacher = () => {
    if (!addTeacherFor || !teacherForm.email?.trim()) return;
    const name = (teacherForm.name || teacherForm.email).trim();
    if (!confirm) { platformData.addTeacherToSchool(addTeacherFor.id, teacherForm.email.trim(), name, schools); setAddTeacherFor(null); setTeacherForm({ email: '', name: '' }); onRefresh?.(); return; }
    confirm(`Add ${name} as a teacher to ${addTeacherFor.name}?`, () => { platformData.addTeacherToSchool(addTeacherFor.id, teacherForm.email.trim(), name, schools); setAddTeacherFor(null); setTeacherForm({ email: '', name: '' }); onRefresh?.(); });
  };

  const handleAddClass = () => {
    if (!addClassFor || !classForm.name?.trim()) return;
    if (!confirm) { platformData.addClassToSchool(addClassFor.id, classForm.name.trim(), classForm.teacherEmail?.trim() || null, schools); setAddClassFor(null); setClassForm({ name: '', teacherEmail: '' }); onRefresh?.(); return; }
    confirm(`Add class "${classForm.name.trim()}" to ${addClassFor.name}?`, () => { platformData.addClassToSchool(addClassFor.id, classForm.name.trim(), classForm.teacherEmail?.trim() || null, schools); setAddClassFor(null); setClassForm({ name: '', teacherEmail: '' }); onRefresh?.(); });
  };

  return (
    <div className="space-y-6 text-slate-800 animate-in fade-in max-w-4xl">
      <div className="bg-white px-4 py-2 rounded-xl inline-block border border-slate-100"><h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Building2 size={28} className="text-violet-500" /> School Management</h2></div>
      <div className="bg-white p-6 rounded-2xl border border-slate-100">
        <h3 className="font-bold text-slate-800 text-lg mb-4">Create school</h3>
        <div className="flex gap-2">
          <input value={newSchoolName} onChange={(e) => setNewSchoolName(e.target.value)} placeholder="School name" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-medium" />
          <button onClick={handleCreate} className="px-6 py-3 bg-violet-500 text-white font-bold rounded-xl">Create</button>
        </div>
      </div>
      <div className="space-y-4">
        {filteredSchools.map(s => (
          <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-100">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h4 className="font-bold text-lg text-slate-800">{s.name}</h4>
                <p className="text-xs text-slate-500">{s.teachers?.length || 0} teachers • {s.classes?.length || 0} classes</p>
              </div>
              <button onClick={() => handleRemoveSchool(s)} className="px-3 py-1.5 bg-rose-100 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-200 transition-colors flex items-center gap-1.5 shrink-0"><Trash2 size={12} /> Remove school</button>
            </div>
            {(s.teachers?.length || 0) > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Teachers</p>
                <div className="flex flex-wrap gap-2">
                  {s.teachers.map(t => (
                    <span key={t.email} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-xs font-medium text-slate-700">
                      {t.name || t.email}
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveTeacher(s, t.email); }} className="p-0.5 rounded hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-colors" title="Remove teacher"><Trash2 size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setAddTeacherFor(s); setTeacherForm({ email: '', name: '' }); }} className="px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg hover:bg-violet-200 transition-colors">Add teacher</button>
              <button onClick={() => { setAddClassFor(s); setClassForm({ name: '', teacherEmail: (s.teachers?.[0]?.email) || '' }); }} className="px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg hover:bg-violet-200 transition-colors">Add class</button>
            </div>
          </div>
        ))}
      </div>

      {addTeacherFor && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add teacher to {addTeacherFor.name}</h3>
              <button onClick={() => { setAddTeacherFor(null); setTeacherForm({ email: '', name: '' }); }} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Email</label>
                <input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm(f => ({ ...f, email: e.target.value }))} placeholder="teacher@school.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Name (optional)</label>
                <input type="text" value={teacherForm.name} onChange={(e) => setTeacherForm(f => ({ ...f, name: e.target.value }))} placeholder="Teacher name" className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setAddTeacherFor(null); setTeacherForm({ email: '', name: '' }); }} className="flex-1 py-3 text-slate-500 font-bold rounded-xl">Cancel</button>
              <button onClick={handleAddTeacher} disabled={!teacherForm.email?.trim()} className="flex-1 py-3 bg-violet-500 text-white font-bold rounded-xl disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}

      {addClassFor && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add class to {addClassFor.name}</h3>
              <button onClick={() => { setAddClassFor(null); setClassForm({ name: '', teacherEmail: '' }); }} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Class name</label>
                <input type="text" value={classForm.name} onChange={(e) => setClassForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Math 101, Period 3" className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Teacher email (optional)</label>
                <input type="email" value={classForm.teacherEmail} onChange={(e) => setClassForm(f => ({ ...f, teacherEmail: e.target.value }))} placeholder="teacher@school.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setAddClassFor(null); setClassForm({ name: '', teacherEmail: '' }); }} className="flex-1 py-3 text-slate-500 font-bold rounded-xl">Cancel</button>
              <button onClick={handleAddClass} disabled={!classForm.name?.trim()} className="flex-1 py-3 bg-violet-500 text-white font-bold rounded-xl disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ParentLinkInput = ({ onLink, confirm }) => {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const doLink = async () => {
    setErr('');
    setLoading(true);
    try {
      const r = await Promise.resolve(onLink(code));
      if (!r.ok) setErr(r.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };
  const handle = () => {
    if (!code.trim()) return;
    if (confirm) {
      confirm(`Link your account using code "${code.trim()}"?`, doLink);
    } else {
      doLink();
    }
  };
  return (
    <div className="flex gap-2">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. TEST-1234" className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium" />
      <button onClick={handle} disabled={loading} className="px-4 py-2 bg-violet-500 text-white font-bold rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed">Link</button>
      {err && <p className="text-rose-600 text-xs">{err}</p>}
    </div>
  );
};

const FloatingNavItem = ({ icon: Icon, label, isActive, onClick, badgeCount, badgeColor = "bg-rose-500" }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-2xl min-w-[60px] transition-all ${isActive ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}>
    <div className="relative">
      <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
      {badgeCount > 0 && (
        <span className={`absolute -top-1.5 -right-1.5 ${badgeColor} text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm`}>
          {badgeCount}
        </span>
      )}
    </div>
    <span className="text-[10px] font-bold mt-1">{label}</span>
  </button>
);

// --- Main Application ---
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default function App() {
  const [showSplash, setShowSplash] = useState(() => isMobileDevice());
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(TABS.OVERVIEW);

  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [recentHistory, setRecentHistory] = useState([]);
  const [hwFilter, setHwFilter] = useState(() => { try { const v = storageGet('hw_filter'); return v && Object.values(HW_FILTERS).includes(v) ? v : HW_FILTERS.DUE; } catch { return HW_FILTERS.DUE; } });

  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileData, setProfileData] = useState({ name: '', grade: '', school: '', favoriteSubject: '', email: '', gamificationLevel: 'simple' });
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [subscriptionPlan, setSubscriptionPlan] = useState('pro');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterSubject, setFilterSubject] = useState(() => { try { return storageGet('hw_subject') || 'All'; } catch { return 'All'; } });
  const [subjects, setSubjects] = useState([...DEFAULT_SUBJECTS]);

  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [teacherCommentDraft, setTeacherCommentDraft] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const confirm = (message, onConfirm, variant = 'default') => setConfirmDialog({ message, onConfirm, variant });
  useEffect(() => {
    if (selectedAssignment) setTeacherCommentDraft(selectedAssignment.teacherComments || '');
  }, [selectedAssignment?.id]);
  const [isCreateAssignmentModalOpen, setIsCreateAssignmentModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', subject: 'Math', dueDate: '', priority: 'Medium', description: '' });
  const [newAssignmentAttachment, setNewAssignmentAttachment] = useState({ file: null, preview: null });
  const [viewMode, setViewMode] = useState(() => { try { return storageGet('hw_viewmode') || 'list'; } catch { return 'list'; } });
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(getDate(0));

  const [studyStreak, setStudyStreak] = useState(0);
  const [pairingCode, setPairingCode] = useState("");
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [selectedChildEmail, setSelectedChildEmail] = useState(null);
  const [riskScore, setRiskScore] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [schoolsRefresh, setSchoolsRefresh] = useState(0);
  const [adminSchools, setAdminSchools] = useState([]);
  const [completionHistoryFromFirestore, setCompletionHistoryFromFirestore] = useState([]);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isAdminCsvImportOpen, setIsAdminCsvImportOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [selectedHwIds, setSelectedHwIds] = useState(new Set());
  const [hwDetailDrawer, setHwDetailDrawer] = useState(null);
  const [statsRange, setStatsRange] = useState('7');
  const [statsPreviewOpen, setStatsPreviewOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return storageGet('hw_sidebar_collapsed') === 'true'; } catch { return false; } });
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isGoogleClassroomImporting, setIsGoogleClassroomImporting] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState(null);
  const [csvImportText, setCsvImportText] = useState('');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [sessionTime, setSessionTime] = useState('00:00:00');
  const sessionStartRef = useRef(Date.now());

  const profileImageInputRef = useRef(null);
  const assignmentFileInputRef = useRef(null);
  const createAssignFileInputRef = useRef(null);
  const csvFileInputRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLocalTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      setSessionTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (appUser?.role !== ROLES.ADMIN) return;
    let cancelled = false;
    (async () => {
      const fromFirestore = await platformData.getSchoolsFromFirestore();
      if (cancelled) return;
      setAdminSchools(Array.isArray(fromFirestore) ? fromFirestore : platformData.getSchools());
    })();
    return () => { cancelled = true; };
  }, [appUser?.role, schoolsRefresh]);

  const firebaseUserId = auth?.currentUser?.uid;

  // One-time migration: remove the 3 original mock assignments (ids 1,2,3 with known titles)
  const MOCK_ASSIGNMENT_IDS = new Set([1, 2, 3]);
  const MOCK_ASSIGNMENT_TITLES = new Set(['Finish Physics Lab', 'Read Chapter 4', 'History Presentation']);
  const removeMockAssignments = (list) =>
    (list || []).filter(a => !(MOCK_ASSIGNMENT_IDS.has(a.id) && MOCK_ASSIGNMENT_TITLES.has(a.title)));

  useEffect(() => {
    if (!firebaseUserId || !appUser || appUser.role === ROLES.PARENT) return;
    let cancelled = false;
    (async () => {
      const [profile, assignments, completions] = await Promise.all([
        platformData.getProfile(firebaseUserId),
        platformData.getAssignments(firebaseUserId),
        platformData.getCompletionHistoryFromFirestore(firebaseUserId),
      ]);
      if (cancelled) return;
      if (profile && typeof profile === 'object') setProfileData(prev => ({ ...prev, ...profile }));
      if (assignments !== null && Array.isArray(assignments)) {
        const cleaned = removeMockAssignments(assignments);
        setAssignments(cleaned);
        if (cleaned.length !== assignments.length) {
          platformData.saveAssignments(firebaseUserId, cleaned).catch(() => {});
        }
      }
      if (Array.isArray(completions)) setCompletionHistoryFromFirestore(completions);
    })();
    return () => { cancelled = true; };
  }, [firebaseUserId, appUser?.role]);

  const getBackgroundClass = () => {
    switch(activeTab) {
      case TABS.OVERVIEW: return 'wallpaper-overview';
      case TABS.HOMEWORK: return 'wallpaper-planner';
      case TABS.ANALYTICS: return 'wallpaper-overview';
      case TABS.SCHOOL: return 'wallpaper-settings';
      case TABS.PAYMENTS: return 'wallpaper-settings';
      case TABS.SETTINGS: return 'wallpaper-settings';
      default: return 'wallpaper-overview';
    }
  };

  const subscriptionUserId = profileData.email || appUser?.name || 'anonymous';
  const currentUserKey = profileData.email || appUser?.name || 'anonymous';
  const viewingStudentKey = appUser?.role === ROLES.PARENT ? selectedChildEmail : currentUserKey;
  const copy = getCopy(appUser?.role || ROLES.STUDENT, profileData.grade);
  const isReadOnly = appUser?.role === ROLES.PARENT;
  useEffect(() => {
    if (appUser?.role === ROLES.PARENT && selectedChildEmail) {
      saveStoredAssignments(selectedChildEmail, assignments);
    } else if (currentUserKey && appUser?.role !== ROLES.PARENT) {
      saveStoredAssignments(currentUserKey, assignments);
      if (firebaseUserId) platformData.saveAssignments(firebaseUserId, assignments).catch(() => {});
    }
  }, [assignments, currentUserKey, appUser?.role, selectedChildEmail, firebaseUserId]);

  useEffect(() => {
    if (appUser?.role === ROLES.PARENT) {
      if (selectedChildEmail) {
        const stored = getStoredAssignments(selectedChildEmail);
        setAssignments(stored && stored.length > 0 ? stored : []);
      } else {
        setAssignments([]);
      }
    }
  }, [selectedChildEmail, appUser?.role]);

  useEffect(() => {
    const userKey = appUser?.role === ROLES.PARENT ? selectedChildEmail : currentUserKey;
    if (!userKey) return;
    const as = appUser?.role === ROLES.PARENT ? getStoredAssignments(selectedChildEmail) || [] : assignments;
    if (as.length === 0) {
      setRiskScore(null);
      setForecast(null);
      return;
    }
    const completions = firebaseUserId && appUser?.role !== ROLES.PARENT
      ? completionHistoryFromFirestore
      : getCompletionHistory(userKey);
    const rec = getActiveRecoveryForStudent(userKey);
    const runRiskCalc = (hist, prevRisk) => {
      const streak = (() => {
        let s = 0;
        for (let i = 0; i < 365; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().split('T')[0];
          if (completions.some(c => c.date === ds)) s++;
          else break;
        }
        return s;
      })();
      const score = computeRiskScore({
        assignments: as,
        completionHistory: completions,
        streak,
        recoveryTarget: rec ? { targetCompletion: rec.requiredCompletions, achieved: rec.achievedCompletions } : null,
      });
      const fore = computeForecast(as, completions);
      setRiskScore(score);
      setForecast(fore);
      if (firebaseUserId && appUser?.role !== ROLES.PARENT) {
        const rest = (hist || []).filter(h => h.date !== getDate(0));
        platformData.saveRiskHistoryToFirestore(firebaseUserId, [...rest, { userKey, score, date: getDate(0) }]).catch(() => {});
      } else {
        const rest = hist.filter(h => h.userKey !== userKey || h.date !== getDate(0));
        platformData.saveRiskHistory([...rest, { userKey, score, date: getDate(0) }]);
      }
      checkAlertTriggers({ studentEmail: userKey, currentRisk: score, previousRisk: prevRisk ?? null, assignments: as, gradeSlope: fore?.trendDirection === 'Downward' ? -15 : null });
      setAlerts(getUnreadAlertsForUser(profileData.email, linkedStudents, appUser?.role));
    };
    if (firebaseUserId && appUser?.role !== ROLES.PARENT) {
      platformData.getRiskHistoryFromFirestore(firebaseUserId).then((hist) => {
        const prevEntry = (hist || []).filter(h => h.date !== getDate(0)).sort((a, b) => b.date.localeCompare(a.date))[0];
        runRiskCalc(hist || [], prevEntry?.score);
      }).catch(() => runRiskCalc([], null));
    } else {
      const hist = platformData.getRiskHistory();
      const prevEntry = hist.filter(h => h.userKey === userKey && h.date !== getDate(0)).sort((a, b) => b.date.localeCompare(a.date))[0];
      runRiskCalc(hist, prevEntry?.score);
    }
  }, [assignments, selectedChildEmail, appUser?.role, currentUserKey, completionHistoryFromFirestore, firebaseUserId]);

  useEffect(() => {
    if (!appUser) return;
    getSubscriptionStatus(subscriptionUserId).then(({ plan }) => setSubscriptionPlan(plan));
  }, [appUser?.name, subscriptionUserId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tid') || params.get('transaction_id');
    if (tid && appUser) {
      verifyPayment(tid, subscriptionUserId).then(({ ok }) => {
        if (ok) setSubscriptionPlan('pro');
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, [appUser?.name]);

  const handleConfirmPlan = async (planOverride) => {
    const plan = planOverride ?? selectedPlan;
    if (plan === 'free') {
      setIsSubscriptionOpen(false);
      return;
    }
    const doCheckout = async () => {
      setCheckoutLoading(true);
      try {
        const result = await initiateProCheckout(subscriptionUserId, profileData.email);
        if (result.capture_url) {
          window.location.href = result.capture_url;
          return;
        }
        if (!result.ok) {
          addToHistory(result.error || 'Checkout failed', 'error');
          showToast(result.error || 'Checkout failed', 'info');
        }
      } finally {
        setCheckoutLoading(false);
      }
    };
    const price = SUBSCRIPTION_PLANS.find(p => p.id === 'pro')?.price ?? 199;
    confirm(`Proceed to checkout? You will be charged R${price}/month for Pro.`, doCheckout);
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const result = await cancelSubscription(subscriptionUserId);
      if (result.ok) {
        const { plan } = await getSubscriptionStatus(subscriptionUserId);
        setSubscriptionPlan(plan || 'free');
        showToast('Subscription cancelled');
        addToHistory('Pro subscription cancelled', 'info');
      } else {
        showToast(result.error || 'Could not cancel', 'info');
      }
    } finally {
      setCancelLoading(false);
    }
  };

  useEffect(() => {
    if (!appUser) return;
    const key = viewingStudentKey || currentUserKey;
    const completions = getEffectiveCompletions(key);
    if (completions.length === 0) {
      const as = appUser?.role === ROLES.PARENT ? getStoredAssignments(selectedChildEmail) || [] : assignments;
      const completed = as.filter(a => a.status === 'Completed' || a.status === 'Submitted');
      if (completed.length > 0 && key) {
        const toSeed = completed.map(a => ({ date: getDate(0), subject: a.subject || 'Other', title: a.title }));
        if (firebaseUserId && appUser?.role !== ROLES.PARENT) {
          setCompletionHistoryFromFirestore(toSeed);
          platformData.saveCompletionHistoryToFirestore(firebaseUserId, toSeed).catch(() => {});
        } else {
          try {
            const raw = storageGet(ANALYTICS_HISTORY_KEY);
            const data = raw ? JSON.parse(raw) : {};
            data[key] = { completions: toSeed };
            storageSet(ANALYTICS_HISTORY_KEY, JSON.stringify(data));
          } catch {}
        }
      }
    }
  }, [appUser?.name, viewingStudentKey, selectedChildEmail, firebaseUserId, appUser?.role, assignments, completionHistoryFromFirestore]);

  useEffect(() => {
    let isMounted = true;
    const restoreFromFirebaseUser = (firebaseUser) => {
      const email = firebaseUser.email || firebaseUser.providerData?.[0]?.email;
      if (!email) return;
      const stored = getStoredUsers().find(u => u.email?.toLowerCase() === email.toLowerCase());
      let role = stored?.role || ROLES.STUDENT;
      const name = firebaseUser.displayName || stored?.name || email?.split('@')[0] || 'User';
      if (!stored) storeUser({ email, name, role, uid: firebaseUser.uid });
      handleB2CLogin({ name, role, email });
    };
    let unsubAuth = null;
    const init = async () => {
      try {
        if (auth) {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult?.user && isMounted) {
            const user = redirectResult.user;
            const stored = getStoredUsers().find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
            let role = stored?.role;
            if (!role) {
              try { role = sessionStorage.getItem('hwc_google_signup_role') || ROLES.STUDENT; sessionStorage.removeItem('hwc_google_signup_role'); } catch { role = ROLES.STUDENT; }
            }
            if (!stored) storeUser({ email: user.email, name: user.displayName || user.email?.split('@')[0] || 'User', role });
            handleB2CLogin({ name: user.displayName || user.email?.split('@')[0] || 'User', role, email: user.email });
            setAuthLoading(false);
            return;
          }
          const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!isMounted) return;
            if (firebaseUser && (firebaseUser.email || firebaseUser.providerData?.[0]?.email)) {
              restoreFromFirebaseUser(firebaseUser);
              setAuthLoading(false);
              return;
            }
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              try {
                const userCred = await signInWithCustomToken(auth, __initial_auth_token);
                if (isMounted) setUser(userCred.user);
              } catch {}
            } else if (!firebaseUser) {
              try {
                const userCred = await signInAnonymously(auth);
                if (isMounted) setUser(userCred.user);
              } catch (e) {
                if (isMounted) setUser(null);
              }
            }
            setAuthLoading(false);
          });
          unsubAuth = unsub;
        }
      } catch (e) {
        console.warn('Auth init:', e?.message);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };
    init();
    return () => { isMounted = false; unsubAuth?.(); };
  }, []);

  const handleB2CLogin = (userData) => {
    if (!userData) return;
    const newAppUser = {
      name: userData.name || "Student",
      role: userData.role || ROLES.STUDENT,
    };
    setAppUser(newAppUser);
    const email = userData.email || '';
    try {
      const stored = storageGet(PROFILE_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      setProfileData({
        name: parsed?.name ?? newAppUser.name,
        grade: parsed?.grade ?? '',
        school: parsed?.school ?? '',
        favoriteSubject: parsed?.favoriteSubject ?? '',
        email: parsed?.email ?? email,
        gamificationLevel: parsed?.gamificationLevel ?? 'simple',
      });
        const userKey = (parsed?.email ?? email) || newAppUser.name;
      const storedAssignments = getStoredAssignments(userKey);
      if (storedAssignments && Array.isArray(storedAssignments) && storedAssignments.length > 0) {
        const cleaned = removeMockAssignments(storedAssignments);
        if (cleaned.length !== storedAssignments.length) saveStoredAssignments(userKey, cleaned);
        setAssignments(cleaned);
      }
      if (newAppUser.role === ROLES.PARENT) {
        platformData.getLinkedStudentsForParent(userKey).then((students) => {
          setLinkedStudents(students);
          setSelectedChildEmail(students[0] || null);
        });
      }
      if (newAppUser.role === ROLES.STUDENT && userKey) {
        platformData.getPairingCodeForStudent(userKey).then((code) => {
          if (code) setPairingCode(code);
          else platformData.generatePairingCode(userKey).then((c) => setPairingCode(c));
        });
      }
    } catch {
      setProfileData({ name: newAppUser.name, grade: '', school: '', favoriteSubject: '', email, gamificationLevel: 'simple' });
    }
  };

  const saveProfile = () => {
    if (!profileData.name?.trim()) return;
    setAppUser(prev => prev ? { ...prev, name: profileData.name.trim() } : null);
    try {
      storageSet(PROFILE_STORAGE_KEY, JSON.stringify(profileData));
    } catch {}
    if (firebaseUserId) platformData.saveProfile(firebaseUserId, profileData).catch(() => {});
    setIsProfileSettingsOpen(false);
  };

  const handleSignOut = () => {
    confirm('Are you sure you want to log out?', async () => {
      if (auth) {
        try { await signOut(auth); } catch {}
      }
      setAppUser(null);
      setActiveTab(TABS.OVERVIEW);
    }, 'danger');
  };

  const addToHistory = (title, type = 'info') => {
    setRecentHistory(prev => [{ id: Date.now(), title, type, time: "Just now" }, ...prev].slice(0, 5));
  };

  const handleLogCompletion = (assignment, userKey) => {
    if (firebaseUserId && appUser?.role !== ROLES.PARENT) {
      platformData.logCompletionToFirestore(firebaseUserId, assignment).catch(() => {});
      setCompletionHistoryFromFirestore(prev => [...prev, { date: getDate(0), subject: assignment.subject || 'Other', title: assignment.title }].slice(-500));
    } else {
      logCompletion(assignment, userKey);
    }
  };

  const getEffectiveCompletions = (userKey) =>
    firebaseUserId && appUser?.role !== ROLES.PARENT ? completionHistoryFromFirestore : getCompletionHistory(userKey);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const pushUndo = (label, undoFn) => {
    const id = Date.now();
    setUndoStack(prev => [...prev.slice(-4), { id, label, undoFn }]);
    setTimeout(() => setUndoStack(prev => prev.filter(u => u.id !== id)), 8000);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !isReadOnly) { e.preventDefault(); setIsCreateAssignmentModalOpen(true); }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        setUndoStack(prev => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          last.undoFn();
          return prev.slice(0, -1);
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { try { storageSet('hw_sidebar_collapsed', String(sidebarCollapsed)); } catch {} }, [sidebarCollapsed]);
  useEffect(() => { try { storageSet('hw_filter', hwFilter); } catch {} }, [hwFilter]);
  useEffect(() => { try { storageSet('hw_subject', filterSubject); } catch {} }, [filterSubject]);

  const subjectsUserId = (appUser?.role === ROLES.STUDENT || appUser?.role === ROLES.TEACHER) ? (auth?.currentUser?.uid ?? profileData.email ?? appUser?.name) : null;
  const [subjectsInitialized, setSubjectsInitialized] = useState(false);
  useEffect(() => {
    if (!subjectsUserId) { setSubjectsInitialized(false); return; }
    setSubjectsInitialized(false);
    platformData.getSubjects(subjectsUserId).then((loaded) => {
      if (loaded && loaded.length > 0) setSubjects(loaded);
      else setSubjects([...DEFAULT_SUBJECTS]);
      setSubjectsInitialized(true);
    });
  }, [subjectsUserId]);
  useEffect(() => {
    if (!subjectsUserId || !subjectsInitialized) return;
    platformData.saveSubjects(subjectsUserId, subjects);
  }, [subjectsUserId, subjectsInitialized, subjects]);
  useEffect(() => { if (subjects.length > 0 && !subjects.includes(newAssignment.subject)) setNewAssignment(prev => ({ ...prev, subject: subjects[0] })); }, [subjects]);
  useEffect(() => { try { storageSet('hw_viewmode', viewMode); } catch {} }, [viewMode]);

  useEffect(() => {
    if (!profileData.email) return;
    let unsub;
    import('./lib/chatService').then(({ getChatsForUser, getUnreadCount }) => {
      unsub = getChatsForUser(profileData.email, (chats) => {
        setChatUnreadCount(getUnreadCount(chats, profileData.email));
      });
    }).catch(() => {});
    return () => { if (unsub) unsub(); };
  }, [profileData.email]);

  const handleCreateAssignFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { addToHistory('File too large (Max 20MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setNewAssignmentAttachment({ file, preview: reader.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateAssignment = (e) => {
    e.preventDefault();
    if (!newAssignment.title) return;
    confirm(`Add "${newAssignment.title}" to your homework?`, () => {
      const effectiveDueDate = newAssignment.dueDate || getDate(0);
      const base = { id: Date.now(), category: 'Homework', status: 'Pending', progress: 0, ...newAssignment, dueDate: effectiveDueDate };
      const assignment = newAssignmentAttachment.file
        ? { ...base, status: 'Submitted', submittedFile: newAssignmentAttachment.file.name, submittedFileType: newAssignmentAttachment.file.type || 'application/octet-stream', submittedPreview: newAssignmentAttachment.preview, submittedAt: getDate(0) }
        : base;
      setAssignments(prev => [assignment, ...prev]);
      setIsCreateAssignmentModalOpen(false);
      showToast(copy.toastAdded);
      addToHistory(`Submitted: ${newAssignment.title}`, 'success');
      setNewAssignment({ title: '', subject: 'Math', dueDate: '', priority: 'Medium', description: '' });
      setNewAssignmentAttachment({ file: null, preview: null });
    });
  };

  const handleDayClick = (dateStr) => setSelectedDate(dateStr);

  const handleGoogleClassroomImport = async () => {
    setIntegrationMessage(null);
    setIsGoogleClassroomImporting(true);
    try {
      const token = await getGoogleClassroomToken();
      if (!token) {
        const hasClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const msg = hasClientId ? 'Sign-in was cancelled or the popup was blocked.' : 'Google Classroom is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file. See docs/PHASE2_SETUP.md for setup.';
        setIntegrationMessage(msg);
        addToHistory('Google Classroom: ' + (hasClientId ? 'cancelled' : 'not configured'), 'error');
        return;
      }
      const items = await fetchAllCoursework(token);
      if (items.length === 0) {
        setIntegrationMessage('No assignments found in your Google Classroom.');
        addToHistory('No assignments found in Google Classroom', 'info');
        return;
      }
      setAssignments(prev => [...items.map(a => ({ ...a, id: a.id || Date.now() + Math.random() })), ...prev]);
      setIntegrationMessage(`Synced ${items.length} assignments from Google Classroom.`);
      addToHistory(`Imported ${items.length} assignments from Google Classroom`, 'success');
    } catch (err) {
      const msg = err?.message || 'Google Classroom sync failed.';
      setIntegrationMessage(msg);
      addToHistory(msg, 'error');
    } finally {
      setIsGoogleClassroomImporting(false);
    }
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setProfileImage(reader.result); addToHistory('Profile picture updated', 'success'); };
      reader.readAsDataURL(file);
    }
  };

  const handleAssignmentFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedAssignment) return;
    if (file.size > 20 * 1024 * 1024) { addToHistory("File too large (Max 20MB)", "error"); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const updatedAssignment = { ...selectedAssignment, status: 'Submitted', submittedFile: file.name, submittedFileType: file.type || 'application/octet-stream', submittedPreview: reader.result };
      setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? updatedAssignment : a));
      setSelectedAssignment(updatedAssignment);
      addToHistory(`Uploaded ${file.name}`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteTask = (taskId) => {
    const task = assignments.find(a => a.id === taskId);
    confirm(`Remove "${task?.title || 'this task'}"? This can be undone.`, () => {
      setAssignments(prev => prev.filter(a => a.id !== taskId));
      setIsUploadModalOpen(false);
      setHwDetailDrawer(null);
      addToHistory("Task removed", "info");
      showToast(copy.toastRemoved, "info");
      if (task) pushUndo("Remove task", () => setAssignments(prev => [task, ...prev]));
    }, 'danger');
  };

  useEffect(() => {
    if (selectedAssignment) setTeacherCommentDraft(selectedAssignment.teacherComments || '');
  }, [selectedAssignment?.id]);

  const handleSaveTeacherComment = () => {
    if (!selectedAssignment || appUser?.role !== ROLES.TEACHER) return;
    if (!teacherCommentDraft.trim()) { showToast('Nothing to save — write a note first', 'info'); return; }
    confirm('Save this note? The student will be able to see it.', () => {
      const updated = { ...selectedAssignment, teacherComments: teacherCommentDraft.trim() };
      setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? updated : a));
      setSelectedAssignment(updated);
      showToast('Note saved');
      addToHistory('Comment saved', 'success');
    });
  };

  const stats = useMemo(() => {
    const today = getDate(0);
    const overdue = assignments.filter(a => a.status !== 'Completed' && a.status !== 'Submitted' && a.dueDate < today).length;
    const dueTodayOrFuture = assignments.filter(a => a.status !== 'Completed' && a.status !== 'Submitted' && a.dueDate >= today).length;
    const completed = assignments.filter(a => a.status === 'Completed' || a.status === 'Submitted').length;
    if (appUser?.role === ROLES.TEACHER) {
      const toGrade = assignments.filter(a => a.status === 'Submitted').length;
      const inProgress = overdue + dueTodayOrFuture;
      const graded = assignments.filter(a => a.status === 'Completed' || (a.status === 'Submitted' && a.teacherComments)).length;
      return { overdue, dueToday: dueTodayOrFuture, completed, toGrade, inProgress, graded };
    }
    return { overdue, dueToday: dueTodayOrFuture, completed };
  }, [assignments, appUser?.role]);

  const analyticsData = useMemo(() => {
    const allCompletions = getEffectiveCompletions(viewingStudentKey || currentUserKey);
    const today = getDate(0);

    const rangeDays = statsRange === 'term' ? 90 : statsRange === '30' ? 30 : 7;
    const rangeStart = (() => { const d = new Date(); d.setDate(d.getDate() - (rangeDays - 1)); return d.toISOString().split('T')[0]; })();
    const completions = allCompletions.filter(c => c.date >= rangeStart);

    const dayDates = [...Array(rangeDays)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (rangeDays - 1 - i));
      return d.toISOString().split('T')[0];
    });

    const byDayRaw = dayDates.map(d => ({ date: d, count: completions.filter(c => c.date === d).length }));
    const bucketSize = rangeDays <= 7 ? 1 : rangeDays <= 30 ? 1 : 7;
    const byDay = bucketSize === 1 ? byDayRaw : (() => {
      const buckets = [];
      for (let i = 0; i < byDayRaw.length; i += bucketSize) {
        const chunk = byDayRaw.slice(i, i + bucketSize);
        buckets.push({ date: chunk[0].date, count: chunk.reduce((s, d) => s + d.count, 0) });
      }
      return buckets;
    })();
    const maxCount = Math.max(1, ...byDay.map(x => x.count));

    const subjectCounts = subjects.reduce((acc, s) => {
      acc[s] = completions.filter(c => c.subject === s).length;
      return acc;
    }, {});
    const totalBySubject = Object.values(subjectCounts).reduce((a, b) => a + b, 0);
    const maxSubj = Math.max(1, ...Object.values(subjectCounts));

    const thisWeekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
    const lastWeekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() - 7); return d.toISOString().split('T')[0]; })();
    const thisWeek = allCompletions.filter(c => c.date >= thisWeekStart).length;
    const lastWeek = allCompletions.filter(c => c.date >= lastWeekStart && c.date < thisWeekStart).length;

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (allCompletions.some(c => c.date === ds)) streak++;
      else break;
    }

    const rangeAssignments = assignments.filter(a => a.dueDate >= rangeStart && a.dueDate <= today);
    const total = rangeAssignments.length;
    const done = rangeAssignments.filter(a => a.status === 'Completed' || a.status === 'Submitted').length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = rangeAssignments.filter(a => a.status !== 'Completed' && a.status !== 'Submitted' && a.dueDate < today).length;
    const onTimeCount = completions.filter(c => {
      const a = assignments.find(x => x.title === c.title && x.subject === c.subject);
      return a ? c.date <= a.dueDate : true;
    }).length;
    const onTimeRate = completions.length > 0 ? Math.round((onTimeCount / completions.length) * 100) : 0;
    const weekDiff = thisWeek - lastWeek;
    const bestDay = (() => {
      const dayCounts = {};
      completions.forEach(c => {
        const day = new Date(c.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      const sorted = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
      return sorted[0] ? sorted[0][0] : null;
    })();
    const topSubject = (() => {
      const sorted = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]);
      return sorted[0] && sorted[0][1] > 0 ? sorted[0][0] : null;
    })();
    const avgPerDay = completions.length > 0 ? (completions.length / rangeDays).toFixed(1) : '0';
    const subjectCompletionRates = subjects.reduce((acc, s) => {
      const subTotal = rangeAssignments.filter(a => a.subject === s).length;
      const subDone = rangeAssignments.filter(a => a.subject === s && (a.status === 'Completed' || a.status === 'Submitted')).length;
      acc[s] = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : null;
      return acc;
    }, {});
    return { byDay, maxCount, subjectCounts, totalBySubject, maxSubj, thisWeek, lastWeek, streak, completionRate, done, total, overdue, onTimeRate, weekDiff, bestDay, topSubject, avgPerDay, subjectCompletionRates, rangeDays };
  }, [assignments, viewingStudentKey, currentUserKey, statsRange, subjects, completionHistoryFromFirestore, firebaseUserId, appUser?.role]);

  const homeworkForSelectedDate = useMemo(() => {
    return assignments.filter(a => a.dueDate === selectedDate);
  }, [assignments, selectedDate]);

  const nextUpAssignments = useMemo(() => {
    const today = getDate(0);
    return assignments
      .filter(a => a.status !== 'Completed' && a.status !== 'Submitted' && a.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
  }, [assignments]);

  const currentTerm = useMemo(() => {
    const m = new Date().getMonth();
    if (m >= 0 && m <= 2) return 'Term 1';
    if (m >= 3 && m <= 5) return 'Term 2';
    if (m >= 6 && m <= 8) return 'Term 3';
    return 'Term 4';
  }, []);

  const riskReasons = useMemo(() => {
    const reasons = [];
    const today = getDate(0);
    const overdue = assignments.filter(a => a.status !== 'Completed' && a.status !== 'Submitted' && a.dueDate < today);
    if (overdue.length > 0) reasons.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);
    const completions = getEffectiveCompletions(viewingStudentKey || currentUserKey);
    let lateStreak = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (!completions.some(c => c.date === ds)) lateStreak++;
      else break;
    }
    if (lateStreak >= 2) reasons.push(`${lateStreak}-day inactivity streak`);
    if (studyStreak < 3) reasons.push('low engagement streak');
    return reasons.slice(0, 3);
  }, [assignments, viewingStudentKey, currentUserKey, studyStreak, completionHistoryFromFirestore, firebaseUserId, appUser?.role]);

  const actionCTA = useMemo(() => {
    if (stats.overdue > 0) {
      const pointsReduction = Math.min(4, Math.round(30 / Math.max(1, assignments.length)));
      return `Complete 1 overdue task today to reduce risk by ~${pointsReduction} points`;
    }
    if (stats.dueToday > 0) return `Finish today's ${stats.dueToday} task${stats.dueToday > 1 ? 's' : ''} to keep your streak alive`;
    return 'All caught up — review upcoming tasks to stay ahead';
  }, [stats, assignments]);

  const getTimeUntilDeadline = (dueDateStr) => {
    const due = new Date(dueDateStr + 'T23:59:59');
    const now = new Date();
    if (due < now) return 'Late';
    const diff = Math.floor((due - now) / 60000);
    if (diff < 60) return `Due in ${diff} min`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (m === 0) return `Due in ${h} ${h === 1 ? 'hour' : 'hours'}`;
    return `Due in ${h}h ${m}m`;
  };

  if (showSplash) return <MobileSplash onDone={() => setShowSplash(false)} />;

  if (authLoading) return (
    <div className="h-[100dvh] wallpaper-auth flex flex-col items-center justify-center relative overflow-hidden">
      <div className="w-full max-w-md px-8 space-y-4">
        <div className="h-8 w-48 bg-white/20 rounded-xl animate-pulse" />
        <div className="h-4 w-32 bg-white/15 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-white/10 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
        </div>
        <div className="h-32 bg-white/10 rounded-2xl animate-pulse mt-4" />
        <div className="h-20 bg-white/10 rounded-2xl animate-pulse" />
      </div>
    </div>
  );

  if (!appUser) return <AuthScreen onLogin={handleB2CLogin} isLoading={authLoading} useFirebase={!!auth} />;

  if (appUser.role === ROLES.ADMIN) {
    const totalTeachers = adminSchools.reduce((sum, s) => sum + (s.teachers?.length || 0), 0);
    const totalClasses = adminSchools.reduce((sum, s) => sum + (s.classes?.length || 0), 0);
    const adminNavItems = [
      { key: TABS.OVERVIEW, icon: Home, label: copy.navHome },
      { key: TABS.ANALYTICS, icon: BarChart2, label: copy.navStats },
      { key: TABS.SCHOOL, icon: Building2, label: 'School' },
      { key: TABS.CHAT, icon: MessageSquare, label: 'Chat', badge: chatUnreadCount, badgeColor: 'bg-violet-500' },
      { key: TABS.PAYMENTS, icon: CreditCard, label: copy.navPayments },
      { key: TABS.SETTINGS, icon: Settings, label: copy.navSettings },
    ];
    return (
      <>
      <input type="file" ref={profileImageInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleProfileImageChange} />
      <input type="file" ref={csvFileInputRef} style={{ display: 'none' }} accept=".csv,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => { setCsvImportText(r.result || ''); }; r.readAsText(f); e.target.value = ''; }} />
      <div className="h-[100dvh] w-full bg-slate-50 font-sans relative flex overflow-hidden">
        <style>{noScrollbarStyles}</style>

        {/* Desktop left sidebar - matches main app */}
        <aside className="hidden md:flex flex-col shrink-0 bg-white border-r border-slate-100 w-56 z-30">
          <div className="h-14 flex items-center border-b border-slate-100 shrink-0 px-5">
            <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 truncate">Homework Companion</span>
          </div>
          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto no-scrollbar">
            {adminNavItems.map(item => (
              <button key={item.key} onClick={() => setActiveTab(item.key)} className={`w-full flex items-center gap-3 rounded-xl transition-all px-3 py-2.5 ${activeTab === item.key ? 'bg-violet-50 text-violet-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <item.icon size={20} strokeWidth={activeTab === item.key ? 2.5 : 2} />
                <span className={`text-sm truncate ${activeTab === item.key ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-slate-100">
            <button onClick={() => setIsProfileSettingsOpen(true)} className="flex items-center gap-3 w-full rounded-xl p-2 hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-500 overflow-hidden shrink-0 border border-violet-200">
                {profileImage ? <img src={profileImage} alt="" className="w-full h-full object-cover" /> : <User size={14} />}
              </div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{appUser.name}</p><p className="text-[10px] text-slate-400 capitalize">{appUser.role}</p></div>
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header bar - matches main app */}
          <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 md:px-6 shrink-0 z-20">
            <div className="flex-1" />
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-lg text-[10px] font-black text-violet-600 uppercase tracking-wider shrink-0"><Building2 size={12} /> Admin</span>
            <div className="relative">
              <button onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-lg text-white flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform shrink-0">
                <Plus size={16} strokeWidth={2.5} />
              </button>
              {isQuickAddOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsQuickAddOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => { setIsAdminCsvImportOpen(true); setIsQuickAddOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"><FileSpreadsheet size={16} className="text-violet-500" /> Import CSV</button>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setIsProfileSettingsOpen(true)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-violet-500 overflow-hidden border border-slate-200 transition-transform hover:scale-105 shrink-0 md:hidden">
              {profileImage ? <img src={profileImage} alt="" className="w-full h-full object-cover" /> : <User size={14} />}
            </button>
          </header>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-8 pb-24 md:pb-8 pt-6">
            {activeTab === TABS.OVERVIEW && (
              <div className="space-y-5 animate-in fade-in text-slate-800 max-w-4xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800">{copy.welcome}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">{appUser.name.split(' ')[0]?.toUpperCase() || appUser.name}</span></h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {copy.status} • {localTime || '--:--:--'} • Session {sessionTime}</p>
                  </div>
                </div>

                {/* Summary cards - same style as main app */}
                <div className="grid grid-cols-3 gap-3">
                  <div onClick={() => setActiveTab(TABS.SCHOOL)} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                    <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-violet-500 uppercase tracking-wider">Schools</p><ChevronRight size={14} className="text-slate-300 group-hover:text-violet-400 transition-colors" /></div>
                    <p className="text-2xl font-black text-violet-600">{adminSchools.length}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Manage schools</p>
                  </div>
                  <div onClick={() => setActiveTab(TABS.SCHOOL)} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                    <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Teachers</p><ChevronRight size={14} className="text-slate-300 group-hover:text-amber-400 transition-colors" /></div>
                    <p className="text-2xl font-black text-amber-600">{totalTeachers}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Across all schools</p>
                  </div>
                  <div onClick={() => setActiveTab(TABS.SCHOOL)} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                    <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Classes</p><ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-400 transition-colors" /></div>
                    <p className="text-2xl font-black text-emerald-600">{totalClasses}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Across all schools</p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="bg-white p-5 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-3">Quick actions</p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => setActiveTab(TABS.SCHOOL)} className="px-5 py-2.5 bg-violet-500 text-white font-bold rounded-xl text-sm hover:bg-violet-600 transition-colors flex items-center gap-2"><Building2 size={18} /> School Management</button>
                    <button onClick={() => setActiveTab(TABS.PAYMENTS)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"><CreditCard size={18} /> Payments</button>
                    <button onClick={() => setIsAdminCsvImportOpen(true)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"><FileSpreadsheet size={18} /> Import CSV</button>
                    <button onClick={() => setActiveTab(TABS.SETTINGS)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"><Settings size={18} /> Settings</button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === TABS.ANALYTICS && (
              <div className="space-y-6 text-slate-800 animate-in fade-in max-w-4xl">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><TrendingUp size={28} className="text-violet-500" /> {copy.analyticsTitle || 'Platform Analytics'}</h2>
                  <button onClick={() => confirm('Export platform stats as CSV?', () => {
                    const rows = adminSchools.map(s => `${s.name},${(s.teachers?.length || 0)},${(s.classes?.length || 0)}`);
                    const csv = 'School,Teachers,Classes\n' + rows.join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'platform-stats.csv'; a.click();
                    URL.revokeObjectURL(url);
                    showToast(copy.toastExported || 'Exported');
                  })} className="px-3 py-1.5 bg-white/80 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white transition-colors flex items-center gap-1 border border-slate-100"><Download size={12} /> {copy.exportBtn || 'Export'}</button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-wider mb-1">Schools</p>
                    <p className="text-2xl font-black text-slate-800">{adminSchools.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">Teachers</p>
                    <p className="text-2xl font-black text-slate-800">{totalTeachers}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-1">Classes</p>
                    <p className="text-2xl font-black text-slate-800">{totalClasses}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-wider mb-1">Avg per school</p>
                    <p className="text-2xl font-black text-slate-800">{adminSchools.length > 0 ? Math.round((totalTeachers + totalClasses) / adminSchools.length) : 0}</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-violet-500" /> Schools by size</h3>
                  <div className="flex items-end justify-between gap-2 h-36">
                    {adminSchools.slice(0, 7).map((s, i) => {
                      const size = (s.teachers?.length || 0) + (s.classes?.length || 0);
                      const maxSize = Math.max(1, ...adminSchools.map(x => (x.teachers?.length || 0) + (x.classes?.length || 0)));
                      const pct = maxSize > 0 ? (size / maxSize) * 100 : 0;
                      return (
                        <div key={s.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[9px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-10">
                            {s.name}<br/><span className="text-slate-400">{size} teachers+classes</span>
                          </div>
                          <div className="w-full flex flex-col justify-end h-28" style={{ minHeight: 112 }}>
                            <div className="w-full rounded-t-lg bg-gradient-to-t from-violet-500 to-fuchsia-500 transition-all" style={{ height: `${Math.max(pct, 4)}%`, minHeight: 8 }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 truncate w-full text-center">{s.name.slice(0, 8)}{s.name.length > 8 ? '…' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                  {adminSchools.length === 0 && (
                    <div className="h-36 flex items-center justify-center text-slate-400">
                      <p className="text-sm font-medium">No schools yet</p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart size={16} className="text-violet-500" /> Schools overview</h3>
                  <div className="space-y-2.5">
                    {adminSchools.map(s => {
                      const tCount = s.teachers?.length || 0;
                      const cCount = s.classes?.length || 0;
                      const total = totalTeachers + totalClasses;
                      const pct = total > 0 ? Math.round(((tCount + cCount) / total) * 100) : 0;
                      return (
                        <div key={s.id} className="flex items-center gap-3">
                          <span className="w-32 text-xs font-bold text-slate-700 truncate">{s.name}</span>
                          <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all" style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }} />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 w-16 text-right">{tCount} teachers, {cCount} classes</span>
                        </div>
                      );
                    })}
                    {adminSchools.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Add schools to see analytics</p>}
                  </div>
                </div>
              </div>
            )}
            {activeTab === TABS.SCHOOL && <SchoolDashboard schools={adminSchools} search={dashboardSearch} key={schoolsRefresh} onRefresh={() => setSchoolsRefresh(Date.now())} confirm={confirm} />}
            {activeTab === TABS.CHAT && (
              <div className="animate-in fade-in h-[calc(100dvh-128px)] md:h-[calc(100dvh-72px)]">
                <Chat userEmail={profileData.email} userName={profileData.name || appUser.name} userRole={appUser.role} isPremium={subscriptionPlan === 'pro'} linkedStudents={linkedStudents} confirm={confirm} />
              </div>
            )}
            {activeTab === TABS.PAYMENTS && (
              <div className="space-y-6 text-slate-800 animate-in fade-in max-w-4xl">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><CreditCard size={28} className="text-violet-500" /> Payments Portal</h2>
                </div>

                {/* Platform revenue overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-wider mb-1">Pro subscribers</p>
                    <p className="text-2xl font-black text-slate-800">—</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Connect API to view</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-1">Revenue (MTD)</p>
                    <p className="text-2xl font-black text-slate-800">—</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Connect API to view</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">New this month</p>
                    <p className="text-2xl font-black text-slate-800">—</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Connect API to view</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-wider mb-1">Churn rate</p>
                    <p className="text-2xl font-black text-slate-800">—</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Connect API to view</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-violet-500" /> Revenue overview</h3>
                  <div className="text-center py-12 rounded-xl bg-slate-50">
                    <Wallet size={40} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Payment data coming soon</p>
                    <p className="text-xs text-slate-400 mt-1">Connect your payment provider (Paygate, Stripe) to see revenue and subscriber analytics</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Lock size={18} className="text-violet-500" /> Payment security</h3>
                  <p className="text-xs text-slate-500">All payments are processed securely via Paygate. POPIA compliant. No card data stored.</p>
                </div>
              </div>
            )}
            {activeTab === TABS.SETTINGS && (
              <div className="space-y-6 text-slate-800 max-w-4xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="text-xl md:text-2xl font-black text-slate-800">{copy.navSettings}</h1>
                </div>
                <div onClick={() => setIsProfileSettingsOpen(true)} className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all">
                  <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-2xl font-bold overflow-hidden border-4 border-white shadow-md">
                    {profileImage ? <img src={profileImage} alt="Profile" className="w-full h-full object-cover" /> : appUser.role[0]}
                  </div>
                  <div><h3 className="font-bold text-slate-800 text-lg">{copy.profileTitle}</h3><p className="text-xs text-slate-500 font-medium">{copy.profileDesc}</p></div>
                  <div className="ml-auto text-violet-300"><ChevronRight size={24} /></div>
                </div>
                <button onClick={handleSignOut} className="w-full bg-white p-4 rounded-xl border border-slate-100 text-rose-500 font-bold flex items-center gap-3 hover:bg-rose-50 transition-colors"><LogOut size={16} /> {copy.logOut || 'Log out'}</button>
              </div>
            )}
          </div>

          {/* Mobile bottom nav - matches main app */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around py-1.5 px-1">
              {adminNavItems.map(item => (
                <FloatingNavItem key={item.key} icon={item.icon} label={item.label} isActive={activeTab === item.key} onClick={() => setActiveTab(item.key)} />
              ))}
            </div>
          </div>
        </div>

        {confirmDialog && (
          <div className="fixed inset-0 z-[600] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDialog(null)}>
            <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
              <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmDialog.variant === 'danger' ? 'bg-rose-100' : 'bg-violet-100'}`}>
                {confirmDialog.variant === 'danger' ? <Trash2 size={22} className="text-rose-500" /> : <CheckCircle2 size={22} className="text-violet-500" />}
              </div>
              <p className="text-sm font-bold text-slate-800 mb-1">Are you sure?</p>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 text-slate-500 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors border border-slate-200">Cancel</button>
                <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm transition-colors ${confirmDialog.variant === 'danger' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-violet-500 hover:bg-violet-600'}`}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
      {isAdminCsvImportOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in" onClick={() => setIsAdminCsvImportOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black text-slate-800">Import schools from CSV</h2><button onClick={() => setIsAdminCsvImportOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button></div>
            <p className="text-xs text-slate-500 mb-2">Columns: schoolName, teacherEmail, teacherName, className</p>
            <button type="button" onClick={() => csvFileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl font-bold text-slate-600 text-sm flex items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/50 transition-colors mb-3">
              <Upload size={18} /> Choose CSV file
            </button>
            <p className="text-[10px] text-slate-400 text-center mb-2">or paste below</p>
            <textarea value={csvImportText} onChange={(e) => setCsvImportText(e.target.value)} placeholder="schoolName,teacherEmail,teacherName,className&#10;Acme High,teacher@acme.com,John Doe,Grade 10A&#10;Acme High,jane@acme.com,Jane Smith,Grade 10B" className="w-full h-32 p-4 rounded-xl border border-slate-200 text-sm font-mono mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setIsAdminCsvImportOpen(false)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl">Cancel</button>
              <button onClick={() => {
                const r = parseSchoolsCSV(csvImportText);
                if (!r.ok) { showToast(r.error || 'Import failed', 'error'); return; }
                if (!r.rows?.length) { showToast('No rows to import', 'info'); return; }
                confirm(`Import ${r.rows.length} row${r.rows.length > 1 ? 's' : ''}? This will create schools and add teachers/classes.`, () => {
                  let created = 0, teachers = 0, classes = 0;
                  let schools = [...adminSchools];
                  for (const row of r.rows) {
                    let school = schools.find(s => s.name.toLowerCase() === row.schoolName.toLowerCase());
                    if (!school) {
                      platformData.createSchool(row.schoolName, 'admin@school.com', schools);
                      created++;
                      schools = platformData.getSchools();
                      school = schools.find(s => s.name.toLowerCase() === row.schoolName.toLowerCase());
                    }
                    if (school && row.teacherEmail) {
                      platformData.addTeacherToSchool(school.id, row.teacherEmail, row.teacherName || row.teacherEmail, schools);
                      teachers++;
                      schools = platformData.getSchools();
                    }
                    if (school && row.className) {
                      platformData.addClassToSchool(school.id, row.className, row.teacherEmail || (school.teachers?.[0]?.email), schools);
                      classes++;
                      schools = platformData.getSchools();
                    }
                  }
                  setSchoolsRefresh(Date.now());
                  setIsAdminCsvImportOpen(false);
                  setCsvImportText('');
                  showToast(`Imported: ${created} schools, ${teachers} teachers, ${classes} classes`);
                });
              }} className="flex-1 py-3 bg-violet-500 text-white font-bold rounded-xl">Import</button>
            </div>
          </div>
        </div>
      )}
      {isProfileSettingsOpen && (
        <div className="fixed inset-0 z-[400] bg-white flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white pt-safe"><button onClick={() => setIsProfileSettingsOpen(false)} className="p-2 hover:bg-slate-50 rounded-full"><ArrowLeft size={24} className="text-slate-800" /></button><h2 className="text-xl font-bold text-slate-800">{copy.profileTitle}</h2></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => profileImageInputRef.current?.click()}>
                <div className="w-32 h-32 rounded-full bg-violet-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">{profileImage ? <img src={profileImage} className="w-full h-full object-cover" alt="Profile" /> : <User size={56} className="text-violet-300" />}</div>
                <div className="absolute bottom-0 right-0 bg-slate-800 text-white p-2.5 rounded-full shadow-md"><Camera size={18} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Name</label>
                <input type="text" value={profileData.name} onChange={(e) => setProfileData(p => ({ ...p, name: e.target.value }))} placeholder={copy.namePlaceholder} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Role</label>
                <input type="text" value={appUser?.role ?? ''} readOnly disabled className="w-full bg-slate-100 p-4 rounded-2xl font-bold border border-slate-200 text-slate-600 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">School</label>
                <input type="text" value={profileData.school} onChange={(e) => setProfileData(p => ({ ...p, school: e.target.value }))} placeholder={copy.schoolPlaceholder} className="w-full bg-slate-50 p-4 rounded-2xl font-medium border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Email</label>
                <input type="email" value={profileData.email} onChange={(e) => setProfileData(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" className="w-full bg-slate-50 p-4 rounded-2xl font-medium border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none" />
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-slate-100 flex gap-3">
            <button onClick={() => setIsProfileSettingsOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl">Cancel</button>
            <button onClick={saveProfile} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl">Save</button>
          </div>
        </div>
      )}
      {isSubscriptionOpen && (() => {
        const activePlan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
        return (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Choose your plan</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Upgrade anytime. Cancel anytime.</p>
                </div>
                <button onClick={() => setIsSubscriptionOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUBSCRIPTION_PLANS.map(plan => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedPlan === plan.id ? 'border-violet-500 bg-violet-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      {plan.badge && <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full">{plan.badge}</span>}
                      <div className="flex items-start justify-between mb-3">
                        <div><h3 className="font-bold text-slate-800">{plan.name}</h3><p className="text-[11px] text-slate-500 mt-0.5">{plan.tagline}</p></div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedPlan === plan.id ? 'bg-violet-500 border-violet-500' : 'border-slate-300'}`}>{selectedPlan === plan.id && <Check size={12} className="text-white" strokeWidth={3} />}</div>
                      </div>
                      <div className="flex items-baseline gap-1"><span className="text-3xl font-black text-slate-800">R{plan.price}</span><span className="text-sm text-slate-400 font-medium">/mo</span></div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">What's included</p>
                  <div className="space-y-2">
                    {activePlan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        {f.included ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> : <X size={15} className="text-slate-300 shrink-0" />}
                        <span className={`text-sm font-medium ${f.included ? 'text-slate-700' : 'text-slate-400'}`}>{f.text}</span>
                        {!f.included && selectedPlan === 'free' && <span className="text-[9px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded ml-auto">PRO</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium py-1">
                  <span className="flex items-center gap-1"><Lock size={11} /> Secure payment</span><span>•</span><span>Cancel anytime</span><span>•</span><span>POPIA compliant</span>
                </div>
              </div>
              <div className="px-6 pb-6 pt-2">
                <button onClick={handleConfirmPlan} disabled={checkoutLoading} className={`w-full py-4 font-black rounded-2xl text-base transition-all disabled:opacity-60 ${selectedPlan === 'free' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:scale-[1.01]'}`}>
                  {checkoutLoading ? 'Redirecting...' : selectedPlan === 'free' ? 'Stay on Free' : `Upgrade to Pro — R${activePlan.price}/mo`}
                </button>
                {selectedPlan !== 'free' && <p className="text-center text-[11px] text-slate-400 mt-2">You'll be redirected to secure checkout</p>}
              </div>
            </div>
          </div>
        </div>
        );
      })()}
      {/* Toast notifications for admin */}
      <div className="fixed top-16 right-4 z-[500] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto animate-in slide-in-from-right fade-in bg-white border border-slate-100 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 min-w-[200px]">
            {t.type === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
            {t.type === 'info' && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
            {t.type === 'error' && <AlertTriangle size={14} className="text-rose-500 shrink-0" />}
            <span className="text-sm font-medium text-slate-700">{t.message}</span>
          </div>
        ))}
      </div>
      </>
    );
  }

  const sidebarNavItems = [
    { key: TABS.OVERVIEW, icon: Home, label: copy.navHome },
    { key: TABS.HOMEWORK, icon: BookOpen, label: copy.navHomework, badge: stats.overdue, badgeColor: 'bg-rose-500', action: () => { setActiveTab(TABS.HOMEWORK); setViewMode('list'); } },
    { key: TABS.ANALYTICS, icon: BarChart2, label: copy.navStats },
    { key: 'calendar', icon: Calendar, label: 'Calendar', action: () => { setActiveTab(TABS.HOMEWORK); setViewMode('calendar'); } },
    { key: TABS.CHAT, icon: MessageSquare, label: 'Chat', badge: chatUnreadCount, badgeColor: 'bg-violet-500' },
    { key: 'alerts', icon: Bell, label: copy.alertsTitle, badge: alerts.length, badgeColor: 'bg-amber-500', action: () => setIsNotifPanelOpen(true) },
    ...(appUser?.role === ROLES.ADMIN ? [{ key: TABS.SCHOOL, icon: Building2, label: 'School' }] : []),
    { key: TABS.PAYMENTS, icon: CreditCard, label: copy.navPayments },
    { key: TABS.SETTINGS, icon: Settings, label: copy.navSettings },
  ];

  return (
    <div className="h-[100dvh] w-full bg-slate-50 font-sans relative flex overflow-hidden">
      <style>{noScrollbarStyles}</style>

      <input type="file" ref={profileImageInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleProfileImageChange} />
      <input type="file" ref={assignmentFileInputRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx" onChange={handleAssignmentFileChange} />
      <input type="file" ref={csvFileInputRef} style={{ display: 'none' }} accept=".csv,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => { setCsvImportText(r.result || ''); }; r.readAsText(f); e.target.value = ''; }} />

      {/* Desktop left sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 bg-white border-r border-slate-100 transition-all duration-300 z-30 ${sidebarCollapsed ? 'w-[68px]' : 'w-56'}`}>
        <div className={`h-14 flex items-center border-b border-slate-100 shrink-0 ${sidebarCollapsed ? 'justify-center px-2' : 'px-5'}`}>
          {!sidebarCollapsed && <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 truncate">Homework Companion</span>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors ${sidebarCollapsed ? '' : 'ml-auto'}`}>
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarNavItems.map(item => {
            const isActive = item.key === 'calendar' ? (activeTab === TABS.HOMEWORK && viewMode === 'calendar') : item.key === TABS.HOMEWORK ? (activeTab === TABS.HOMEWORK && viewMode !== 'calendar') : item.key === activeTab;
            return (
              <button key={item.key} onClick={() => { if (item.action) item.action(); else setActiveTab(item.key); }} className={`w-full flex items-center gap-3 rounded-xl transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'} ${isActive ? 'bg-violet-50 text-violet-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                <div className="relative shrink-0">
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {item.badge > 0 && <span className={`absolute -top-1.5 -right-1.5 ${item.badgeColor} text-white text-[8px] font-bold min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center`}>{item.badge}</span>}
                </div>
                {!sidebarCollapsed && <span className={`text-sm truncate ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className={`p-3 border-t border-slate-100 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button onClick={() => setIsProfileSettingsOpen(true)} className={`flex items-center gap-3 w-full rounded-xl p-2 hover:bg-slate-50 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-500 overflow-hidden shrink-0 border border-violet-200">
              {profileImage ? <img src={profileImage} alt="" className="w-full h-full object-cover" /> : <User size={14} />}
            </div>
            {!sidebarCollapsed && <div className="min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{appUser.name}</p><p className="text-[10px] text-slate-400 capitalize">{appUser.role}</p></div>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 md:px-6 shrink-0 z-20">
          <div className="flex-1 max-w-xs relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={dashboardSearch}
              onChange={e => { setDashboardSearch(e.target.value); setSearchOpen(!!e.target.value); }}
              onFocus={() => { if (dashboardSearch) setSearchOpen(true); }}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder={copy.searchPlaceholder}
              className="w-full pl-8 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all placeholder:text-slate-400 text-slate-700"
            />
            {dashboardSearch && (
              <button onClick={() => { setDashboardSearch(''); setSearchOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
            {searchOpen && dashboardSearch.trim() && (() => {
              const term = dashboardSearch.toLowerCase().trim();
              const close = () => { setSearchOpen(false); setDashboardSearch(''); };

              const pageItems = sidebarNavItems.filter(n => n.label.toLowerCase().includes(term));

              const actionItems = [
                { label: 'Add homework', keywords: 'add homework create assignment new task', icon: Plus, action: () => setIsCreateAssignmentModalOpen(true) },
                { label: 'Import CSV', keywords: 'import csv spreadsheet upload', icon: Upload, action: () => setIsCsvImportOpen(true) },
                { label: 'Edit profile', keywords: 'edit profile picture name grade school avatar photo', icon: User, action: () => setIsProfileSettingsOpen(true) },
                { label: 'Log out', keywords: 'log out sign out logout signout', icon: LogOut, action: () => signOut(auth) },
                { label: 'Notifications', keywords: 'notifications alerts bell reminders', icon: Bell, action: () => setIsNotifPanelOpen(true) },
                { label: 'Chat', keywords: 'chat message messaging conversation talk communicate whatsapp', icon: MessageSquare, action: () => setActiveTab(TABS.CHAT) },
                { label: 'Overdue tasks', keywords: 'overdue late missing behind', icon: AlertTriangle, action: () => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.OVERDUE); setViewMode('list'); } },
                { label: 'Completed tasks', keywords: 'completed done finished submitted', icon: CheckCircle2, action: () => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.COMPLETED); setViewMode('list'); } },
                { label: 'Due tasks', keywords: 'due pending upcoming todo to do', icon: Clock, action: () => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.DUE); setViewMode('list'); } },
              ].filter(a => a.keywords.includes(term) || a.label.toLowerCase().includes(term));

              const settingsItems = [
                { label: 'Manage subjects', desc: 'Add or remove subjects', keywords: 'subjects manage add remove subject math science english history art coding', icon: BookOpen, action: () => setActiveTab(TABS.SETTINGS) },
                { label: 'Subscription plans', desc: 'Free & Pro plans', keywords: 'subscription plan free pro upgrade premium payment billing pricing r199 cancel', icon: CreditCard, action: () => setActiveTab(TABS.PAYMENTS) },
                { label: 'Payment history', desc: 'View past invoices', keywords: 'payment history invoice receipt billing', icon: Wallet, action: () => setActiveTab(TABS.PAYMENTS) },
                { label: 'Integrations', desc: 'Google Classroom sync', keywords: 'integrations google classroom connect sync lms', icon: RefreshCw, action: () => setActiveTab(TABS.SETTINGS) },
                { label: 'Pairing code', desc: 'Link parent account', keywords: 'pairing code parent link share connect family', icon: Users, action: () => setActiveTab(TABS.SETTINGS) },
                { label: 'Analytics & stats', desc: 'Completion, streaks, trends', keywords: 'analytics stats statistics completion streak trend chart graph progress insights forecast', icon: BarChart2, action: () => setActiveTab(TABS.ANALYTICS) },
                { label: 'Risk score', desc: 'Academic risk assessment', keywords: 'risk score assessment low moderate high critical', icon: AlertTriangle, action: () => setActiveTab(TABS.ANALYTICS) },
                { label: 'Recovery plan', desc: 'Catch-up targets', keywords: 'recovery plan catch up catchup target improve', icon: Target, action: () => setActiveTab(TABS.OVERVIEW) },
                { label: 'Activity log', desc: 'Recent actions', keywords: 'activity log history recent actions', icon: History, action: () => setActiveTab(TABS.OVERVIEW) },
              ].filter(a => a.keywords.includes(term) || a.label.toLowerCase().includes(term) || (a.desc && a.desc.toLowerCase().includes(term)));

              const subjectResults = subjects.filter(s => s.toLowerCase().includes(term)).map(s => ({
                label: s, icon: BookOpen, action: () => { setActiveTab(TABS.HOMEWORK); setViewMode('list'); setFilterSubject(s); }
              }));

              const schoolResults = (appUser?.role === ROLES.ADMIN ? adminSchools : [])
                .filter(s => s.name.toLowerCase().includes(term))
                .slice(0, 4)
                .map(s => ({ label: s.name, icon: Building2, action: () => setActiveTab(TABS.SCHOOL) }));

              const childResults = (appUser?.role === ROLES.PARENT ? linkedStudents : [])
                .filter(e => e.toLowerCase().includes(term))
                .map(e => ({ label: e, icon: Users, action: () => setSelectedChildEmail(e) }));

              const hwResults = assignments.filter(a =>
                a.title.toLowerCase().includes(term) || a.subject.toLowerCase().includes(term) || (a.description || '').toLowerCase().includes(term)
              ).slice(0, 5);

              const sections = [
                { title: 'Pages', items: pageItems.map(n => ({ label: n.label, Icon: n.icon, action: () => { if (n.action) n.action(); else setActiveTab(n.key); } })) },
                { title: 'Actions', items: actionItems.map(a => ({ label: a.label, Icon: a.icon, action: a.action })) },
                { title: 'Features', items: settingsItems.map(a => ({ label: a.label, desc: a.desc, Icon: a.icon, action: a.action })) },
                { title: 'Subjects', items: subjectResults.map(a => ({ label: a.label, Icon: a.icon, action: a.action })) },
                ...(schoolResults.length > 0 ? [{ title: 'Schools', items: schoolResults.map(a => ({ label: a.label, Icon: a.icon, action: a.action })) }] : []),
                ...(childResults.length > 0 ? [{ title: 'Students', items: childResults.map(a => ({ label: a.label, Icon: a.icon, action: a.action })) }] : []),
              ].filter(s => s.items.length > 0);

              const totalResults = sections.reduce((sum, s) => sum + s.items.length, 0) + hwResults.length;

              return (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 max-h-96 overflow-y-auto">
                  {totalResults === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400 font-medium">No results found</div>
                  )}
                  {sections.map(section => (
                    <div key={section.title}>
                      <div className="px-4 pt-2.5 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-t border-slate-50 first:border-0">{section.title}</div>
                      {section.items.map((item, i) => (
                        <button key={i} onMouseDown={() => { close(); item.action(); }} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                          <item.Icon size={16} className="text-violet-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{item.label}</p>
                            {item.desc && <p className="text-[10px] text-slate-400">{item.desc}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                  {hwResults.length > 0 && (
                    <div>
                      <div className="px-4 pt-2.5 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-t border-slate-50">Assignments</div>
                      {hwResults.map(a => {
                        const isDone = a.status === 'Completed' || a.status === 'Submitted';
                        const isOverdue = a.dueDate < getDate(0) && !isDone;
                        return (
                          <button key={a.id} onMouseDown={() => { close(); setSelectedAssignment(a); setIsUploadModalOpen(true); }} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                            <BookOpen size={16} className="text-violet-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate">{a.title}</p>
                              <p className="text-[10px] text-slate-400">{a.subject} • Due {new Date(a.dueDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${isDone ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>
                              {isDone ? copy.statusDone : isOverdue ? copy.statusLate : copy.statusOpen}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-lg text-[10px] font-black text-violet-600 uppercase tracking-wider shrink-0"><Calendar size={12} /> {currentTerm}</span>
          {appUser.role === ROLES.STUDENT && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 py-1.5 rounded-lg text-white shadow-sm shrink-0">
              <Flame size={12} fill="currentColor" />
              <span className="text-[10px] font-black">{studyStreak}d</span>
            </div>
          )}
          {!isReadOnly && (
            <div className="relative">
              <button onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-lg text-white flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform">
                <Plus size={16} strokeWidth={2.5} />
              </button>
              {isQuickAddOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsQuickAddOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => { setIsCreateAssignmentModalOpen(true); setIsQuickAddOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"><BookOpen size={16} className="text-violet-500" /> {copy.addHomework}</button>
                    <button onClick={() => { setIsCsvImportOpen(true); setIsQuickAddOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors border-t border-slate-50"><FileSpreadsheet size={16} className="text-violet-500" /> Import CSV</button>
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)} className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors shrink-0">
            <Bell size={16} />
            {alerts.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white">{alerts.length}</span>}
          </button>
          <button onClick={() => setIsProfileSettingsOpen(true)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-violet-500 overflow-hidden border border-slate-200 transition-transform hover:scale-105 shrink-0 md:hidden">
            {profileImage ? <img src={profileImage} alt="" className="w-full h-full object-cover" /> : <User size={14} />}
          </button>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-8 pb-24 md:pb-8 pt-6">

        {activeTab === TABS.OVERVIEW && (
          <div className="space-y-5 animate-in fade-in text-slate-800 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-800">{copy.welcome}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">{appUser.name.split(' ')[0]?.toUpperCase() || appUser.name}</span></h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {copy.status} • {localTime || '--:--:--'} • Session {sessionTime}</p>
              </div>
              {alerts.length > 0 && (
                <button onClick={() => setIsNotifPanelOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                  <BellRing size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{alerts.length} {copy.alertsNeedAttention}</span>
                </button>
              )}
            </div>

            {/* Summary cards - role-specific */}
            {appUser.role === ROLES.TEACHER ? (
              <div className="grid grid-cols-3 gap-3">
                <div onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.OVERDUE); }} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">Overdue</p><ChevronRight size={14} className="text-slate-300 group-hover:text-rose-400 transition-colors" /></div>
                  <p className="text-2xl font-black text-rose-600">{stats.overdue}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">{stats.overdue > 0 ? 'tasks past due' : 'none overdue'}</p>
                </div>
                <div onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.DUE); }} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">To Grade</p><ChevronRight size={14} className="text-slate-300 group-hover:text-amber-400 transition-colors" /></div>
                  <p className="text-2xl font-black text-amber-600">{stats.toGrade ?? 0}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">submitted by students</p>
                </div>
                <div onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.COMPLETED); }} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Graded</p><ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-400 transition-colors" /></div>
                  <p className="text-2xl font-black text-emerald-600">{stats.graded ?? 0}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">tasks reviewed</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.OVERDUE); }} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">{copy.cardLate}</p><ChevronRight size={14} className="text-slate-300 group-hover:text-rose-400 transition-colors" /></div>
                  <p className="text-2xl font-black text-rose-600">{stats.overdue}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">{stats.overdue > 0 ? copy.alertsNeedAttention : copy.statAllCaughtUp}</p>
                </div>
                <div onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.DUE); }} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-violet-500 uppercase tracking-wider">{copy.cardTodo}</p><ChevronRight size={14} className="text-slate-300 group-hover:text-violet-400 transition-colors" /></div>
                  <p className="text-2xl font-black text-violet-600">{stats.dueToday}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">{copy.cardTasksTodo}</p>
                </div>
                <div onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.COMPLETED); }} className="bg-white p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border border-slate-100 group">
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">{copy.cardDone}</p><ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-400 transition-colors" /></div>
                  <p className="text-2xl font-black text-emerald-600">{stats.completed}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">{copy.cardCompleted}</p>
                </div>
              </div>
            )}

            {/* Active recovery target */}
            {(appUser.role === ROLES.STUDENT || (appUser.role === ROLES.PARENT && selectedChildEmail)) && (() => { const r = getActiveRecoveryForStudent(viewingStudentKey); return r; })() && (
              <div className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-violet-500">
                <p className="text-[10px] font-black text-violet-600 uppercase tracking-wider mb-1">{copy.recoveryPlan}</p>
                {(() => { const rec = getActiveRecoveryForStudent(viewingStudentKey); return rec ? <p className="text-sm font-medium text-slate-700">{rec.achievedCompletions} of {rec.requiredCompletions} days completed • {rec.targetCompletionPct}% target</p> : null; })()}
              </div>
            )}

            {/* At Risk module - only show when there's enough meaningful data */}
            {(appUser.role === ROLES.STUDENT || (appUser.role === ROLES.PARENT && selectedChildEmail)) && riskScore != null && assignments.length >= 3 && assignments.some(a => a.status !== 'Completed' && a.status !== 'Submitted') && (
              <div className={`bg-white p-5 rounded-xl border border-slate-100 border-l-4 cursor-pointer hover:shadow-md transition-all ${riskScore >= 80 ? 'border-l-emerald-500' : riskScore >= 60 ? 'border-l-amber-500' : riskScore >= 40 ? 'border-l-orange-500' : 'border-l-rose-500'}`} onClick={() => setActiveTab(TABS.ANALYTICS)}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={14} className={riskScore >= 80 ? 'text-emerald-500' : riskScore >= 60 ? 'text-amber-500' : 'text-rose-500'} />
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{copy.riskTitle}</p>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-slate-800">{riskScore}</p>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${riskScore >= 80 ? 'bg-emerald-100 text-emerald-700' : riskScore >= 60 ? 'bg-amber-100 text-amber-700' : riskScore >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'}`}>{riskScore >= 80 ? copy.riskLow : riskScore >= 60 ? copy.riskModerate : riskScore >= 40 ? copy.riskHigh : copy.riskCritical}</span>
                    </div>
                    {riskReasons.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1.5">Top reasons: {riskReasons.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {forecast && forecast.trendDirection && <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${forecast.trendDirection === 'Upward' ? 'bg-emerald-100 text-emerald-700' : forecast.trendDirection === 'Downward' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{forecast.trendDirection}</span>}
                    {forecast && forecast.projectedGrade != null && <span className="text-sm font-black text-slate-600">{forecast.projectedGrade}%</span>}
                  </div>
                </div>
                {/* Action-driven CTA */}
                <div className="mt-3 flex items-center gap-3 bg-slate-50 p-3 rounded-lg">
                  <Zap size={14} className="text-violet-500 shrink-0" />
                  <p className="text-xs font-bold text-slate-700 flex-1">{actionCTA}</p>
                  {stats.overdue > 0 && (
                    <button onClick={() => { setActiveTab(TABS.HOMEWORK); setHwFilter(HW_FILTERS.OVERDUE); }} className="px-3 py-1.5 bg-violet-500 text-white text-[10px] font-bold rounded-lg shrink-0 hover:bg-violet-600 transition-colors">{copy.completeBtn}</button>
                  )}
                  {(appUser.role === ROLES.STUDENT || appUser.role === ROLES.PARENT) && riskScore < 60 && !getActiveRecoveryForStudent(viewingStudentKey) && (
                    <button onClick={() => confirm('Start a 7-day recovery plan?', () => { createRecoveryTarget(viewingStudentKey, 95, 7); showToast(copy.toastRecoveryCreated); })} className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-lg shrink-0">{copy.recoveryPlan}</button>
                  )}
                </div>
              </div>
            )}

            {/* Alerts summary → opens notification panel */}
            {alerts.length > 0 && (
              <div onClick={() => setIsNotifPanelOpen(true)} className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Alerts</p>
                  <span className="text-[10px] font-bold text-violet-500">{copy.viewAll}</span>
                </div>
                {alerts.slice(0, 2).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-medium text-slate-600 truncate">{a.message}</span>
                  </div>
                ))}
                {alerts.length > 2 && <p className="text-[10px] text-slate-400 mt-1">+{alerts.length - 2} more</p>}
              </div>
            )}

            {/* Parent: Child selector */}
            {appUser.role === ROLES.PARENT && (
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                {linkedStudents.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase w-full mb-2">Viewing</p>
                    {linkedStudents.map(em => (
                      <button key={em} onClick={() => setSelectedChildEmail(em)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedChildEmail === em ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{em}</button>
                    ))}
                  </div>
                ) : (
                  <ParentLinkInput confirm={confirm} onLink={async (code) => { const r = await platformData.linkParentToStudent(code, profileData.email); if (r.ok) { const students = await platformData.getLinkedStudentsForParent(profileData.email); setLinkedStudents(students); setSelectedChildEmail(r.studentEmail); } return r; }} />
                )}
              </div>
            )}

            {/* Two-column: Focus Area (left) + Recent & Next Up (right) */}
            <div className="grid md:grid-cols-5 gap-5">
              <div className="md:col-span-3 space-y-4">
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-3">{copy.focusLabel}</p>
                  <div className="mb-3 bg-violet-50 p-3 rounded-lg flex items-center gap-3">
                    <Zap size={14} className="text-violet-500 shrink-0" />
                    <p className="text-xs font-bold text-slate-700 leading-snug">{actionCTA}</p>
                  </div>
                  {(() => {
                    const next = assignments.find(a => a.status === 'Pending');
                    if (!next) return (
                      <div className="text-center py-8 text-slate-400 rounded-xl bg-slate-50">
                        <p className="font-bold">{copy.allCaughtUp}</p>
                        <p className="text-xs mt-1">Great job clearing your list.</p>
                      </div>
                    );
                    return (
                      <div className="bg-slate-50 rounded-xl p-5 border-l-4 border-violet-500">
                        <div className="flex items-start gap-4">
                          <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                              <path fill="none" stroke="rgb(203 213 225)" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <path fill="none" stroke="url(#violetGrad)" strokeWidth="3" strokeDasharray={`${getAssignmentProgress(next)}, ${100 - getAssignmentProgress(next)}`} strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <defs><linearGradient id="violetGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#d946ef" /></linearGradient></defs>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700">{getAssignmentProgress(next)}%</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-black uppercase mb-2">{copy.comingUpLabel}</span>
                            <p className="text-[10px] text-violet-500 font-medium mb-0.5">{next.subject}</p>
                            <h4 className="font-black text-slate-800 text-lg leading-tight">{next.title}</h4>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{next.description || copy.notesPlaceholder}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              <span className="text-[10px] font-bold text-violet-600">{getTimeUntilDeadline(next.dueDate)}</span>
                              <span className="text-[10px] font-black text-slate-600">{next.priority === 'High' ? copy.priorityHigh : copy.filterDue}</span>
                            </div>
                            <button onClick={() => { setSelectedAssignment(next); setIsUploadModalOpen(true); }} className="mt-4 w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity">Open</button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">{copy.recentLabel}</p>
                    <button onClick={() => setIsActivityLogOpen(true)} className="text-[10px] font-bold text-violet-500 hover:text-violet-600">{copy.viewAll}</button>
                  </div>
                  <div className="space-y-3">
                    {recentHistory.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No activity yet</p>
                    ) : recentHistory.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'}`}>
                          {item.type === 'success' ? <CheckCircle2 size={16} /> : <History size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700">{item.title}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">{copy.comingUpLabel}</p>
                    <Calendar size={14} className="text-violet-500" />
                  </div>
                  <div className="space-y-3">
                    {nextUpAssignments.length > 0 ? nextUpAssignments.map((a) => (
                      <div key={a.id} onClick={() => { setSelectedAssignment(a); setIsUploadModalOpen(true); }} className="flex items-center gap-3 cursor-pointer hover:bg-white/50 p-2 rounded-xl -mx-2 transition-colors">
                        <span className="text-[10px] font-black text-violet-600 shrink-0">{new Date(a.dueDate).getDate()} {new Date(a.dueDate).toLocaleString('default',{month:'short'}).toUpperCase()}</span>
                        <p className="text-sm font-bold text-slate-700 truncate">{a.title}</p>
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400">{copy.emptyComingUp}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === TABS.HOMEWORK && (() => {
          const today = getDate(0);
          const filteredHw = assignments.filter(a => {
            const isDone = a.status === 'Completed' || a.status === 'Submitted';
            const subjectOk = filterSubject === 'All' || a.subject === filterSubject;
            if (!subjectOk) return false;
            if (hwFilter === HW_FILTERS.OVERDUE) return a.dueDate < today && !isDone;
            if (hwFilter === HW_FILTERS.DUE) return a.dueDate >= today && !isDone;
            return isDone;
          });
          const allSelected = filteredHw.length > 0 && filteredHw.every(a => selectedHwIds.has(a.id));
          return (
          <div className="animate-in slide-in-from-bottom-4 text-slate-800">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h1 className="text-lg font-black text-slate-800">{copy.homeworkTitle}</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsFilterModalOpen(true)} className="px-3 py-1.5 bg-white/80 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors flex items-center gap-1.5" title={copy.filterBy}>
                  <Filter size={14} /> {copy.filterBy}
                </button>
                <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="px-3 py-1.5 bg-white/80 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors flex items-center gap-1.5">
                  <Calendar size={14} /> {viewMode === 'list' ? 'Calendar' : 'List'}
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="flex gap-6">
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Filters bar */}
                  <div className="bg-white p-2 rounded-xl border border-slate-100 flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-white/60 rounded-lg p-0.5">
                      {Object.entries(HW_FILTERS).map(([k, f]) => (
                        <button key={f} onClick={() => { setHwFilter(f); setSelectedHwIds(new Set()); }} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors ${hwFilter === f ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-white'}`}>{k === 'OVERDUE' ? copy.filterOverdue : k === 'DUE' ? copy.filterDue : copy.filterCompleted}</button>
                      ))}
                    </div>
                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setFilterSubject('All')} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${filterSubject === 'All' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-white'}`}>All</button>
                      {subjects.map(sub => (
                        <button key={sub} onClick={() => setFilterSubject(sub)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${filterSubject === sub ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-white'}`}>{sub}</button>
                      ))}
                    </div>
                    {!isReadOnly && selectedHwIds.size > 0 && (
                      <>
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="text-[10px] font-bold text-violet-600">{selectedHwIds.size} {copy.selectedCount}</span>
                        <button onClick={() => confirm(`Mark ${selectedHwIds.size} task${selectedHwIds.size > 1 ? 's' : ''} as complete?`, () => { const now = getDate(0); const ids = [...selectedHwIds]; setAssignments(prev => prev.map(a => ids.includes(a.id) ? { ...a, status: 'Completed', progress: 100, submittedAt: now } : a)); ids.forEach(id => { const a = assignments.find(x => x.id === id); if (a) { handleLogCompletion(a, viewingStudentKey); } }); setSelectedHwIds(new Set()); showToast(copy.toastMarkedDone); addToHistory(`Completed ${ids.length} tasks`, 'success'); })} className="px-2.5 py-1 bg-emerald-500 text-white rounded-md text-[10px] font-bold">{copy.markDone}</button>
                        <button onClick={() => confirm(`Export ${selectedHwIds.size} task${selectedHwIds.size > 1 ? 's' : ''} as CSV?`, () => { const data = filteredHw.filter(a => selectedHwIds.has(a.id)).map(a => `${a.subject},${a.title},${a.dueDate},${a.status},${a.priority}`); const csv = 'Subject,Task,Due Date,Status,Priority\n' + data.join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'homework-export.csv'; link.click(); URL.revokeObjectURL(url); showToast(copy.toastExported); })} className="px-2.5 py-1 bg-slate-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1"><Download size={10} /> {copy.exportBtn}</button>
                      </>
                    )}
                  </div>

                  {/* Table header */}
                  <div className={`hidden sm:grid ${isReadOnly ? 'grid-cols-[1fr_120px_100px_80px_80px]' : 'grid-cols-[32px_1fr_120px_100px_80px_80px]'} gap-3 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider`}>
                    {!isReadOnly && <div><input type="checkbox" checked={allSelected} onChange={(e) => { if (e.target.checked) setSelectedHwIds(new Set(filteredHw.map(a => a.id))); else setSelectedHwIds(new Set()); }} className="accent-violet-500" /></div>}
                    <div>{copy.colTask}</div>
                    <div>{copy.colSubject}</div>
                    <div>{copy.colDueDate}</div>
                    <div>{copy.colStatus}</div>
                    <div>{copy.colPriority}</div>
                  </div>

                  {/* Task rows */}
                  <div className="space-y-1.5">
                    {filteredHw.map(a => {
                      const isDone = a.status === 'Completed' || a.status === 'Submitted';
                      const isOverdue = a.dueDate < today && !isDone;
                      return (
                        <div key={a.id} onClick={() => { setHwDetailDrawer(a); setSelectedAssignment(a); }} className={`bg-white rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition-all border border-slate-100 grid grid-cols-1 ${isReadOnly ? 'sm:grid-cols-[1fr_120px_100px_80px_80px]' : 'sm:grid-cols-[32px_1fr_120px_100px_80px_80px]'} gap-3 items-center ${hwDetailDrawer?.id === a.id ? 'ring-2 ring-violet-400' : ''}`}>
                          {!isReadOnly && <div className="hidden sm:block" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedHwIds.has(a.id)} onChange={() => setSelectedHwIds(prev => { const next = new Set(prev); if (next.has(a.id)) next.delete(a.id); else next.add(a.id); return next; })} className="accent-violet-500" />
                          </div>}
                          <div className="min-w-0">
                            <h4 className={`font-bold text-sm truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{a.title}</h4>
                            <p className="text-[10px] text-slate-400 truncate sm:hidden">{a.subject} • Due {a.dueDate}</p>
                          </div>
                          <div className="hidden sm:block"><span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-bold">{a.subject}</span></div>
                          <div className={`hidden sm:block text-xs font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-500'}`}>{new Date(a.dueDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                          <div className="hidden sm:block"><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${isDone ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>{isDone ? copy.statusDone : isOverdue ? copy.statusLate : copy.statusOpen}</span></div>
                          <div className="hidden sm:block"><span className={`text-[10px] font-bold ${a.priority === 'High' ? 'text-rose-500' : a.priority === 'Medium' ? 'text-amber-500' : 'text-slate-400'}`}>{a.priority === 'High' ? copy.priorityHigh : a.priority === 'Medium' ? copy.priorityMedium : copy.priorityLow}</span></div>
                        </div>
                      );
                    })}
                    {filteredHw.length === 0 && (
                      <div className="bg-white p-8 rounded-xl text-center border border-slate-100">
                        <p className="font-bold text-slate-500">{copy.noHomework}</p>
                        {!isReadOnly && <button onClick={() => setIsCreateAssignmentModalOpen(true)} className="mt-3 px-4 py-2 bg-violet-500 text-white text-xs font-bold rounded-lg">{copy.addFirstTask}</button>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right-side detail drawer */}
                {hwDetailDrawer && (
                  <div className="hidden lg:block w-80 shrink-0 animate-in slide-in-from-right-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-100 sticky top-4 max-h-[calc(100dvh-160px)] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-bold">{hwDetailDrawer.subject}</span>
                        <button onClick={() => setHwDetailDrawer(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={16} className="text-slate-400" /></button>
                      </div>
                      <h3 className="font-black text-lg text-slate-800 mb-1">{hwDetailDrawer.title}</h3>
                      <p className="text-xs text-slate-500 mb-4">Due {new Date(hwDetailDrawer.dueDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1"><span>{copy.progressLabel}</span><span>{getAssignmentProgress(hwDetailDrawer)}%</span></div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all" style={{ width: `${getAssignmentProgress(hwDetailDrawer)}%` }} /></div>
                      </div>

                      {/* Notes */}
                      <div className="mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{copy.notesSection}</p>
                        <div className="bg-slate-50 p-3 rounded-xl"><p className="text-xs text-slate-600 leading-relaxed">{hwDetailDrawer.description || copy.notesPlaceholder}</p></div>
                      </div>

                      {/* Attachments */}
                      <div className="mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{copy.attachments}</p>
                        {hwDetailDrawer.submittedFile ? (
                          <div className="flex items-center gap-2 bg-emerald-50 p-2 rounded-lg"><Upload size={12} className="text-emerald-600" /><span className="text-xs font-medium text-slate-700 truncate flex-1">{hwDetailDrawer.submittedFile}</span></div>
                        ) : (
                          isReadOnly ? <p className="text-xs text-slate-400">{copy.noAttachments}</p> : <button onClick={() => assignmentFileInputRef.current?.click()} className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-xs font-medium text-slate-500 hover:border-violet-300 transition-colors"><Upload size={12} className="inline mr-1" />{copy.uploadDoc}</button>
                        )}
                      </div>

                      {/* Teacher comments */}
                      <div className="mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{copy.comments}</p>
                        <div className="bg-amber-50/60 p-3 rounded-xl"><p className="text-xs text-slate-600">{hwDetailDrawer.teacherComments || copy.noFeedback}</p></div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {!isReadOnly && hwDetailDrawer.status !== 'Completed' && hwDetailDrawer.status !== 'Submitted' && (
                          <button onClick={() => confirm(`Mark "${hwDetailDrawer.title}" as complete?`, () => { const now = getDate(0); setAssignments(prev => prev.map(x => x.id === hwDetailDrawer.id ? { ...x, status: 'Completed', progress: 100, submittedAt: now } : x)); handleLogCompletion(hwDetailDrawer, viewingStudentKey); updateRecoveryProgress(viewingStudentKey, 1); showToast(copy.toastMarkedDone); addToHistory(`Completed: ${hwDetailDrawer.title}`, 'success'); setHwDetailDrawer(null); })} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl text-sm">{copy.completeBtn}</button>
                        )}
                        {!isReadOnly && <button onClick={() => { setSelectedAssignment(hwDetailDrawer); setIsUploadModalOpen(true); }} className="w-full py-2 text-violet-600 font-bold rounded-xl text-xs hover:bg-violet-50 transition-colors">{copy.openDetails}</button>}
                        {!isReadOnly && <button onClick={() => handleDeleteTask(hwDetailDrawer.id)} className="w-full py-2 text-rose-500 font-bold rounded-xl text-xs hover:bg-rose-50 transition-colors flex items-center justify-center gap-1"><Trash2 size={12} /> {copy.removeBtn}</button>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-black text-slate-800">{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                      <button onClick={() => { setCalendarDate(new Date()); setSelectedDate(getDate(0)); }} className="text-[10px] font-black text-violet-500 uppercase tracking-widest text-left mt-0.5 hover:text-violet-700 transition-colors">{copy.calendarToday}</button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={20} /></button>
                      <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={20} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-[10px] font-bold text-slate-300 uppercase">{d}</div>)}
                  </div>
                  {(() => {
                    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
                    const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
                    const totalWeeks = Math.ceil((daysInMonth + firstDay) / 7);
                    return (
                      <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(40px, 1fr))` }}>
                        {(() => {
                          const days = [];
                          for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="w-full h-full opacity-0 pointer-events-none" />);
                          for (let i = 1; i <= daysInMonth; i++) {
                            const currentDateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                            const tasks = assignments.filter(a => a.dueDate === currentDateStr);
                            const todayStr = getDate(0);
                            const isSelected = selectedDate === currentDateStr;
                            const isToday = todayStr === currentDateStr;
                            let styleClasses = 'rounded-2xl flex flex-col items-center justify-center text-xs font-bold cursor-pointer transition-all w-full h-full relative p-2 ';
                            if (isSelected) styleClasses += 'bg-slate-800 text-white ring-4 ring-slate-100 z-10 scale-105 shadow-xl';
                            else if (tasks.length > 0) { const hasOverdue = tasks.some(t => (t.status !== 'Completed' && t.status !== 'Submitted') && t.dueDate < todayStr); styleClasses += hasOverdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'; }
                            else if (isToday) styleClasses += 'bg-violet-50 text-violet-600 ring-1 ring-violet-200';
                            else styleClasses += 'text-slate-400 hover:bg-slate-50';
                            days.push(
                              <div key={i} onClick={() => handleDayClick(currentDateStr)} className={styleClasses}>
                                {i}
                                {tasks.length > 0 && <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : (tasks.some(t => t.dueDate < todayStr && t.status !== 'Completed') ? 'bg-rose-500' : 'bg-emerald-500')}`} />}
                              </div>
                            );
                          }
                          return days;
                        })()}
                      </div>
                    );
                  })()}
                </div>
                <div className="animate-in fade-in slide-in-from-top-2 pb-12">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><Clock size={18} className="text-violet-500" /><h3 className="font-bold text-slate-500 text-base">{new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3></div>
                    {!isReadOnly && <button onClick={() => setIsCreateAssignmentModalOpen(true)} className="text-xs font-black text-violet-500 uppercase tracking-widest hover:bg-violet-50 px-3 py-1.5 rounded-xl transition-colors">+ {copy.addHomework}</button>}
                  </div>
                  <div className="space-y-3">
                    {homeworkForSelectedDate.length > 0 ? homeworkForSelectedDate.map(a => (
                      <div key={a.id} onClick={() => { setSelectedAssignment(a); setIsUploadModalOpen(true); }} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3"><div className={`p-2 rounded-xl text-white ${a.status === 'Completed' ? 'bg-emerald-400' : 'bg-violet-400'}`}>{a.subject === 'Math' ? <Calculator size={16} /> : <BookOpen size={16} />}</div><div><h4 className="font-bold text-slate-800 text-sm">{a.title}</h4><p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{a.subject}</p></div></div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${a.status === 'Completed' || a.status === 'Submitted' ? 'text-emerald-500' : a.dueDate < getDate(0) ? 'text-rose-500' : 'text-violet-500'}`}>{(a.status === 'Completed' || a.status === 'Submitted') ? copy.statusCompleted : a.dueDate < getDate(0) ? copy.statusOverdue : copy.statusOpen}</span>
                      </div>
                    )) : (
                      <div className="bg-white p-8 rounded-xl border border-slate-100 text-center text-slate-400"><p className="text-sm font-bold">{copy.noTasks}</p></div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {activeTab === TABS.ANALYTICS && (
          <div className="space-y-6 text-slate-800 animate-in fade-in">
            {subscriptionPlan !== 'pro' ? (
              <div className="bg-white p-10 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4"><Lock size={28} className="text-violet-500" /></div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Advanced Stats</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-xs">Upgrade to Pro to unlock completion trends, risk trajectory, and subject breakdowns.</p>
                <button onClick={() => setIsSubscriptionOpen(true)} className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl text-sm shadow-lg hover:scale-[1.02] transition-all">Upgrade to Pro</button>
              </div>
            ) : (
              <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><TrendingUp size={28} className="text-violet-500" /> {copy.analyticsTitle || 'Advanced Stats'}</h2>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 bg-white/80 rounded-lg p-0.5">
                  {[{ v: '7', l: '7d' }, { v: '30', l: '30d' }, { v: 'term', l: 'Term' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setStatsRange(v)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-colors ${statsRange === v ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-white'}`}>{l}</button>
                  ))}
                </div>
                {!isReadOnly && <button onClick={() => confirm('Export stats as CSV?', () => {
                  const rows = analyticsData.byDay.map(d => `${d.date},${d.count}`);
                  const csv = 'Date,Completions\n' + rows.join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'stats-export.csv'; a.click();
                  URL.revokeObjectURL(url);
                  showToast(copy.toastExported);
                })} className="px-3 py-1.5 bg-white/80 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white transition-colors flex items-center gap-1"><Download size={12} /> {copy.exportBtn}</button>}
              </div>
            </div>

            {analyticsData.total === 0 ? (
              <div className="bg-white p-10 rounded-2xl text-center border border-slate-100">
                <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4"><BarChart2 size={28} className="text-violet-400" /></div>
                <h3 className="font-bold text-slate-700 mb-1">{copy.statNoData}</h3>
                <p className="text-sm text-slate-500 mb-4">{copy.statUnlockTrends}</p>
                {!isReadOnly && <button onClick={() => setIsCreateAssignmentModalOpen(true)} className="px-5 py-2.5 bg-violet-500 text-white font-bold rounded-xl text-sm">{copy.addHomework}</button>}
              </div>
            ) : (
              <>
            {/* Row 1: Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-wider mb-1">{copy.statCompletion}</p>
                <div className="flex items-end gap-1.5">
                  <p className="text-2xl font-black text-slate-800">{analyticsData.completionRate}%</p>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" style={{ width: `${analyticsData.completionRate}%` }} /></div>
                <p className="text-[10px] text-slate-500 mt-1">{analyticsData.done} of {analyticsData.total} tasks</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-1">{copy.statOnTime}</p>
                <p className="text-2xl font-black text-slate-800">{analyticsData.onTimeRate}%</p>
                <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className={`h-full rounded-full ${analyticsData.onTimeRate >= 80 ? 'bg-emerald-500' : analyticsData.onTimeRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${analyticsData.onTimeRate}%` }} /></div>
                <p className="text-[10px] text-slate-500 mt-1">{analyticsData.overdue > 0 ? `${analyticsData.overdue} ${copy.statOverdueNow}` : copy.statAllCaughtUp}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">{copy.statStreak}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black text-slate-800">{analyticsData.streak}</p>
                  <span className="text-xs font-bold text-slate-400">{copy.statDays}</span>
                </div>
                {profileData.gamificationLevel !== 'off' && analyticsData.streak >= 7 && <span className="inline-block mt-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">7-day badge</span>}
                {analyticsData.streak >= 3 && analyticsData.streak < 7 && <div className="flex gap-0.5 mt-2">{[...Array(7)].map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < analyticsData.streak ? 'bg-amber-400' : 'bg-slate-100'}`} />)}</div>}
                {analyticsData.streak < 3 && <p className="text-[10px] text-slate-500 mt-1">{copy.statKeepGoing}</p>}
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-wider mb-1">{copy.statThisWeek}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-slate-800">{analyticsData.thisWeek}</p>
                  {analyticsData.weekDiff !== 0 && (
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${analyticsData.weekDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {analyticsData.weekDiff > 0 ? '↑' : '↓'} {Math.abs(analyticsData.weekDiff)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">vs {analyticsData.lastWeek} {copy.statLastWeek.toLowerCase()}</p>
              </div>
            </div>

            {/* Row 2: Risk score + insights side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Risk overview - only show with enough meaningful data */}
              {riskScore != null && assignments.length >= 3 && assignments.some(a => a.status !== 'Completed' && a.status !== 'Submitted') && (
                <div className={`bg-white p-5 rounded-xl border border-slate-100 border-l-4 ${riskScore >= 80 ? 'border-l-emerald-500' : riskScore >= 60 ? 'border-l-amber-500' : riskScore >= 40 ? 'border-l-orange-500' : 'border-l-rose-500'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{copy.riskTitle}</p>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke={riskScore >= 80 ? '#10b981' : riskScore >= 60 ? '#f59e0b' : riskScore >= 40 ? '#f97316' : '#ef4444'} strokeWidth="3" strokeDasharray={`${riskScore * 0.88} 88`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800">{riskScore}</span>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${riskScore >= 80 ? 'text-emerald-600' : riskScore >= 60 ? 'text-amber-600' : riskScore >= 40 ? 'text-orange-600' : 'text-rose-600'}`}>{riskScore >= 80 ? copy.riskLow : riskScore >= 60 ? copy.riskModerate : riskScore >= 40 ? copy.riskHigh : copy.riskCritical}</p>
                      {riskReasons.length > 0 && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{riskReasons.slice(0, 2).join(' · ')}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick insights */}
              <div className="bg-white p-5 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">{copy.statInsights}</p>
                <div className="space-y-2.5">
                  {analyticsData.bestDay && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0"><Zap size={14} className="text-violet-500" /></div>
                      <p className="text-xs text-slate-600"><span className="font-bold text-slate-800">{copy.statMostProductive}</span> {analyticsData.bestDay}s</p>
                    </div>
                  )}
                  {analyticsData.topSubject && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><Target size={14} className="text-emerald-500" /></div>
                      <p className="text-xs text-slate-600"><span className="font-bold text-slate-800">{copy.statTopSubject}</span> {analyticsData.topSubject}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Flame size={14} className="text-amber-500" /></div>
                      <p className="text-xs text-slate-600"><span className="font-bold text-slate-800">{copy.statDailyAvg}</span> {analyticsData.avgPerDay} {copy.statTasksPerDay}</p>
                  </div>
                  {forecast && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0"><TrendingUp size={14} className="text-sky-500" /></div>
                      <p className="text-xs text-slate-600"><span className="font-bold text-slate-800">{copy.statForecast}</span> {forecast.trendDirection}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Completions chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart2 size={18} className="text-violet-500" /> {copy.statCompletions}</h3>
                <span className="text-[10px] font-bold text-slate-400">Last {statsRange === 'term' ? 'term' : statsRange + ' days'}</span>
              </div>
              <div className="flex items-end justify-between gap-1.5 h-36">
                {analyticsData.byDay.map(({ date, count }) => {
                  const isToday = date === getDate(0);
                  return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[9px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
                      {count} task{count !== 1 ? 's' : ''}<br/><span className="text-slate-400">{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="w-full flex flex-col justify-end h-28" style={{ minHeight: 112 }}>
                      <div className={`w-full rounded-t-lg transition-all cursor-pointer ${isToday ? 'bg-gradient-to-t from-violet-600 to-fuchsia-500' : 'bg-gradient-to-t from-violet-400 to-fuchsia-400 opacity-70'} hover:opacity-100`} style={{ height: `${(count / analyticsData.maxCount) * 100}%`, minHeight: count > 0 ? 8 : 2 }} />
                    </div>
                    <span className={`text-[10px] font-bold ${isToday ? 'text-violet-600' : 'text-slate-400'}`}>{analyticsData.rangeDays <= 7 ? new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }) : new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Row 4: Subject breakdown + per-subject completion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart size={16} className="text-violet-500" /> {copy.statBySubject}</h3>
                <div className="space-y-2.5">
                  {subjects.map(sub => {
                    const n = analyticsData.subjectCounts[sub] || 0;
                    const pct = analyticsData.totalBySubject > 0 ? Math.round((n / analyticsData.totalBySubject) * 100) : 0;
                    return (
                      <div key={sub}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700">{sub}</span>
                          <span className="text-[10px] font-black text-slate-500">{n} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all" style={{ width: `${analyticsData.maxSubj > 0 ? (n / analyticsData.maxSubj) * 100 : 0}%`, minWidth: n > 0 ? 4 : 0 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> {copy.statSubjectHealth}</h3>
                <div className="space-y-2">
                  {subjects.filter(s => analyticsData.subjectCompletionRates[s] !== null).map(sub => {
                    const rate = analyticsData.subjectCompletionRates[sub];
                    return (
                      <div key={sub} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-xs font-bold text-slate-700">{sub}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${rate}%` }} /></div>
                          <span className={`text-[11px] font-black w-10 text-right ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {subjects.filter(s => analyticsData.subjectCompletionRates[s] !== null).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">{copy.statNoData}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 5: Weekly comparison */}
            <div className="bg-white p-5 rounded-xl border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity size={16} className="text-violet-500" /> {copy.statWeeklyCompare}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-xl bg-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{copy.statThisWeek}</p>
                  <p className="text-3xl font-black text-slate-800">{analyticsData.thisWeek}</p>
                  <p className="text-[10px] text-slate-500">{copy.statCompleted}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{copy.statLastWeek}</p>
                  <p className="text-3xl font-black text-slate-800">{analyticsData.lastWeek}</p>
                  <p className="text-[10px] text-slate-500">{copy.statCompleted}</p>
                </div>
              </div>
              {analyticsData.weekDiff !== 0 && (
                <div className={`mt-3 p-2.5 rounded-lg text-center text-xs font-bold ${analyticsData.weekDiff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                  {analyticsData.weekDiff > 0 ? `↑ ${analyticsData.weekDiff} ${copy.statMoreThanLast}` : `↓ ${Math.abs(analyticsData.weekDiff)} ${copy.statFewerThanLast}`}
                </div>
              )}
              {analyticsData.weekDiff === 0 && analyticsData.thisWeek > 0 && (
                <div className="mt-3 p-2.5 rounded-lg text-center text-xs font-bold bg-slate-50 text-slate-500">{copy.statSamePace}</div>
              )}
            </div>
              </>
            )}
              </>
            )}
          </div>
        )}

        {activeTab === TABS.CHAT && (
          <div className="animate-in fade-in h-[calc(100dvh-128px)] md:h-[calc(100dvh-72px)]">
            <Chat
              userEmail={profileData.email}
              userName={profileData.name || appUser.name}
              userRole={appUser.role}
              isPremium={subscriptionPlan === 'pro'}
              linkedStudents={linkedStudents}
              confirm={confirm}
            />
          </div>
        )}

        {activeTab === TABS.SCHOOL && appUser?.role === ROLES.ADMIN && (
          <SchoolDashboard schools={adminSchools} search={dashboardSearch} key={schoolsRefresh} onRefresh={() => setSchoolsRefresh(Date.now())} confirm={confirm} />
        )}

        {activeTab === TABS.PAYMENTS && (
          <div className="space-y-6 text-slate-800 animate-in fade-in max-w-4xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><CreditCard size={28} className="text-violet-500" /> {copy.navPayments}</h2>
            </div>

            {/* Current plan */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Current plan</p>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${subscriptionPlan === 'pro' ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500' : 'bg-slate-100'}`}>
                    {subscriptionPlan === 'pro' ? <Sparkles size={28} className="text-white" /> : <Wallet size={28} className="text-slate-500" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">{subscriptionPlan === 'pro' ? 'Pro' : 'Free'}</h3>
                    <p className="text-xs text-slate-500">{subscriptionPlan === 'pro' ? 'Advanced stats, 15 GB storage, priority support' : 'Basic features — upgrade for more'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel subscription - visible for Pro users */}
            {subscriptionPlan === 'pro' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 border-l-4 border-l-slate-200">
                <h3 className="font-bold text-slate-800 mb-1">Manage subscription</h3>
                <p className="text-xs text-slate-500 mb-4">Cancel your Pro subscription anytime. You'll keep access until the end of your billing period.</p>
                <button onClick={() => confirm('Cancel your Pro subscription? You\'ll keep access until the end of your billing period, then return to Free.', () => handleCancelSubscription(), 'danger')} disabled={cancelLoading} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-60 flex items-center gap-2">
                  {cancelLoading ? 'Cancelling...' : 'Cancel subscription'}
                </button>
              </div>
            )}

            {/* Sign up to Premium - full checkout portal */}
            {subscriptionPlan !== 'pro' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 border-l-4 border-l-violet-500">
                <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2"><Sparkles size={20} className="text-violet-500" /> Sign up to Premium</h3>
                <p className="text-xs text-slate-500 mb-4">Choose your plan and complete checkout. Upgrade anytime. Cancel anytime.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {SUBSCRIPTION_PLANS.map(plan => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedPlan === plan.id ? 'border-violet-500 bg-violet-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      {plan.badge && <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full">{plan.badge}</span>}
                      <div className="flex items-start justify-between mb-3">
                        <div><h4 className="font-bold text-slate-800">{plan.name}</h4><p className="text-[11px] text-slate-500 mt-0.5">{plan.tagline}</p></div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPlan === plan.id ? 'bg-violet-500 border-violet-500' : 'border-slate-300'}`}>{selectedPlan === plan.id && <Check size={12} className="text-white" strokeWidth={3} />}</div>
                      </div>
                      <div className="flex items-baseline gap-1"><span className="text-3xl font-black text-slate-800">R{plan.price}</span><span className="text-sm text-slate-400 font-medium">/mo</span></div>
                      <div className="mt-3 space-y-1.5">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {f.included ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <X size={14} className="text-slate-300 shrink-0" />}
                            <span className={f.included ? 'text-slate-600' : 'text-slate-400'}>{f.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <button onClick={handleConfirmPlan} disabled={checkoutLoading} className={`px-6 py-3 font-black rounded-xl text-sm transition-all disabled:opacity-60 ${selectedPlan === 'free' ? 'bg-slate-100 text-slate-600' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:scale-[1.02]'}`}>
                    {checkoutLoading ? 'Redirecting...' : selectedPlan === 'free' ? 'Stay on Free' : `Subscribe to Pro — R${SUBSCRIPTION_PLANS.find(p => p.id === 'pro')?.price || 199}/mo`}
                  </button>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Lock size={12} /> Secure</span>
                    <span>•</span>
                    <span>POPIA compliant</span>
                  </div>
                </div>
              </div>
            )}

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-400 font-medium py-4">
              <span className="flex items-center gap-1"><Lock size={12} /> Secure payment</span>
              <span>•</span>
              <span>Cancel anytime</span>
              <span>•</span>
              <span>POPIA compliant</span>
            </div>

            {/* Payment history placeholder */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><History size={18} className="text-violet-500" /> Payment history</h3>
              <p className="text-xs text-slate-500 mb-4">View and download past invoices</p>
              <div className="text-center py-8 rounded-xl bg-slate-50">
                <CreditCard size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-400">No payment history yet</p>
                <p className="text-xs text-slate-400 mt-1">Payments will appear here after upgrade</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === TABS.SETTINGS && (
          <div className="space-y-6 text-slate-800">
            <div className="bg-white px-4 py-2 rounded-xl mb-4 inline-block border border-slate-100"><h2 className="text-2xl font-black text-slate-800">Settings</h2></div>
            <div onClick={() => setIsProfileSettingsOpen(true)} className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-2xl font-bold overflow-hidden border-4 border-white shadow-md">
                {profileImage ? <img src={profileImage} alt="Profile" className="w-full h-full object-cover" /> : appUser.role[0]}
              </div>
              <div><h3 className="font-bold text-slate-800 text-lg">{copy.profileTitle}</h3><p className="text-xs text-slate-500 font-medium">{copy.profileDesc}</p></div>
              <div className="ml-auto text-violet-300"><ChevronRight size={24} /></div>
            </div>
            {(appUser?.role === ROLES.STUDENT || appUser?.role === ROLES.TEACHER) && (
              <div className="bg-white p-5 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-800 text-lg mb-1 flex items-center gap-2"><BookOpen size={18} className="text-violet-500" /> Subjects</h3>
                <p className="text-xs text-slate-500 mb-4">Add or remove subjects for homework and filters</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map(sub => (
                    <span key={sub} className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 rounded-xl text-sm font-bold">
                      {sub}
                      <button type="button" onClick={() => { if (subjects.length <= 1) { showToast('Keep at least one subject'); return; } confirm(`Remove "${sub}" from your subjects?`, () => setSubjects(prev => prev.filter(s => s !== sub)), 'danger'); }} className="p-0.5 rounded hover:bg-violet-200 text-violet-600 transition-colors" title="Remove subject"><X size={14} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newSubjectInput} onChange={(e) => setNewSubjectInput(e.target.value)} placeholder="New subject name" className="flex-1 bg-slate-50 p-3 rounded-xl font-medium text-slate-700 border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none placeholder:text-slate-400" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), newSubjectInput.trim() && !subjects.includes(newSubjectInput.trim()) && (setSubjects(prev => [...prev, newSubjectInput.trim()]), setNewSubjectInput('')))}
                  />
                  <button type="button" onClick={() => { const v = newSubjectInput.trim(); if (v && !subjects.includes(v)) { setSubjects(prev => [...prev, v]); setNewSubjectInput(''); showToast(`Added ${v}`); } }} className="px-4 py-3 bg-violet-500 text-white font-bold rounded-xl text-sm hover:bg-violet-600 transition-colors">Add</button>
                  <button type="button" onClick={() => confirm('Reset subjects to defaults? Your custom subjects will be removed.', () => { setSubjects([...DEFAULT_SUBJECTS]); showToast('Reset to default subjects'); }, 'danger')} className="px-4 py-3 text-slate-500 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors">Reset</button>
                </div>
              </div>
            )}
            {appUser.role === ROLES.STUDENT && pairingCode && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 text-lg mb-1">Pairing code</h3>
                <p className="text-xs text-slate-500 font-medium mb-3">Share this code with a parent to link accounts</p>
                <p className="text-2xl font-black text-violet-600 tracking-widest">{pairingCode}</p>
              </div>
            )}
            {!isReadOnly && (
              <div className="space-y-2">
                <button type="button" onClick={() => confirm('Sync Google Classroom? This will add your assignments from Google Classroom to your list.', handleGoogleClassroomImport)} disabled={isGoogleClassroomImporting} className={`w-full text-left bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all disabled:opacity-75 disabled:cursor-wait ${integrationMessage ? 'ring-2 ring-violet-300' : ''}`}>
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"><BookOpen size={28} /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-700 text-lg">Integrations</h3>
                    <p className="text-xs text-slate-500 font-medium">{isGoogleClassroomImporting ? 'Syncing…' : 'Connect Google Classroom to sync assignments'}</p>
                  </div>
                  <ChevronRight size={24} className="text-violet-300 shrink-0" />
                </button>
                {integrationMessage && (
                  <p className="text-xs font-medium text-slate-600 px-2">{integrationMessage}</p>
                )}
              </div>
            )}
            <button onClick={handleSignOut} className="w-full bg-white p-4 rounded-xl border border-slate-100 text-rose-500 font-bold flex items-center gap-3 hover:bg-rose-50 transition-colors"><LogOut size={16} /> {copy.logOut || 'Log out'}</button>
          </div>
        )}
      </div>

      {/* Mobile bottom nav bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around py-1.5 px-1">
          <FloatingNavItem icon={Home} label={copy.navHome} isActive={activeTab === TABS.OVERVIEW} onClick={() => setActiveTab(TABS.OVERVIEW)} />
          <FloatingNavItem icon={BookOpen} label={copy.navHomework} isActive={activeTab === TABS.HOMEWORK && viewMode !== 'calendar'} onClick={() => { setActiveTab(TABS.HOMEWORK); setViewMode('list'); }} badgeCount={stats.overdue} badgeColor="bg-rose-500" />
          <FloatingNavItem icon={BarChart2} label={copy.navStats} isActive={activeTab === TABS.ANALYTICS} onClick={() => setActiveTab(TABS.ANALYTICS)} />
          <FloatingNavItem icon={MessageSquare} label="Chat" isActive={activeTab === TABS.CHAT} onClick={() => setActiveTab(TABS.CHAT)} badgeCount={chatUnreadCount} badgeColor="bg-violet-500" />
          {appUser?.role === ROLES.ADMIN && <FloatingNavItem icon={Building2} label="School" isActive={activeTab === TABS.SCHOOL} onClick={() => setActiveTab(TABS.SCHOOL)} />}
          <FloatingNavItem icon={CreditCard} label={copy.navPayments} isActive={activeTab === TABS.PAYMENTS} onClick={() => setActiveTab(TABS.PAYMENTS)} />
          <FloatingNavItem icon={Settings} label={copy.navSettings} isActive={activeTab === TABS.SETTINGS} onClick={() => setActiveTab(TABS.SETTINGS)} />
        </div>
      </div>
      </div>{/* close main content area */}

      {/* Notification center panel */}
      {isNotifPanelOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/20" onClick={() => setIsNotifPanelOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[101] animate-in slide-in-from-right flex flex-col">
            <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><Bell size={16} /> Notifications</h2>
              <button onClick={() => setIsNotifPanelOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 text-center"><Bell size={32} className="text-slate-200 mx-auto mb-3" /><p className="text-sm font-bold text-slate-500">{copy.statAllCaughtUp}</p><p className="text-xs text-slate-400 mt-1">{copy.allCaughtUp}</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {alerts.map(a => (
                    <div key={a.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle size={14} className="text-amber-600" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">{a.message}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{a.type || 'Alert'} • {a.date || 'Today'}</p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => confirm('Dismiss this alert?', () => { markAlertRead(a.id, profileData.email); setAlerts(getUnreadAlertsForUser(profileData.email, linkedStudents, appUser?.role)); showToast(copy.toastDismissed); })} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-200 transition-colors">{copy.toastDismissed}</button>
                            {riskScore != null && riskScore < 60 && assignments.length > 0 && !getActiveRecoveryForStudent(viewingStudentKey) && (
                              <button onClick={() => confirm('Start a 7-day recovery plan?', () => { createRecoveryTarget(viewingStudentKey, 95, 7); showToast(copy.toastRecoveryCreated); })} className="px-2.5 py-1 bg-violet-500 text-white rounded text-[10px] font-bold hover:bg-violet-600 transition-colors">{copy.startRecovery}</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Activity log panel */}
      {isActivityLogOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/20" onClick={() => setIsActivityLogOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[101] animate-in slide-in-from-right flex flex-col">
            <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><Activity size={16} /> Activity Log</h2>
              <button onClick={() => setIsActivityLogOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {recentHistory.length === 0 ? (
                <div className="p-8 text-center"><Activity size={32} className="text-slate-200 mx-auto mb-3" /><p className="text-sm font-bold text-slate-500">No activity yet</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {recentHistory.map(item => (
                    <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'success' ? 'bg-emerald-100 text-emerald-600' : item.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                        {item.type === 'success' ? <CheckCircle2 size={14} /> : <History size={14} />}
                      </div>
                      <div><p className="text-xs font-bold text-slate-700">{item.title}</p><p className="text-[10px] text-slate-400">{item.time}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast notifications */}
      <div className="fixed top-16 right-4 z-[500] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto animate-in slide-in-from-right fade-in bg-white border border-slate-100 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 min-w-[200px]">
            {t.type === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
            {t.type === 'info' && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
            {t.type === 'error' && <X size={14} className="text-rose-500 shrink-0" />}
            <span className="text-xs font-bold text-slate-700">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Undo bar */}
      {undoStack.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom fade-in">
          <div className="bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3">
            <span className="text-xs font-medium">{undoStack[undoStack.length - 1].label}</span>
            <button onClick={() => { const last = undoStack[undoStack.length - 1]; last.undoFn(); setUndoStack(prev => prev.slice(0, -1)); showToast(copy.toastUndone); }} className="text-xs font-bold text-violet-300 hover:text-white transition-colors">{copy.toastUndone}</button>
          </div>
        </div>
      )}

      {isCreateAssignmentModalOpen && !isReadOnly && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">{copy.addHomeworkModal}</h2>
              <button onClick={() => { setIsCreateAssignmentModalOpen(false); setNewAssignmentAttachment({ file: null, preview: null }); }} className="p-2 bg-slate-100 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-6">
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">{copy.assignmentLabel}</label><input type="text" required value={newAssignment.title} onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })} placeholder={copy.assignmentPlaceholder} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 outline-none" /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">{copy.colSubject}</label><select value={newAssignment.subject} onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 outline-none">{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">{copy.notesLabel}</label><textarea value={newAssignment.description} onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })} placeholder={copy.notesPlaceholder} className="w-full bg-slate-50 p-4 rounded-2xl font-medium text-slate-700 outline-none h-24 placeholder:text-slate-400" /></div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">{copy.uploadDoc || 'Upload document'}</label>
                <input type="file" ref={createAssignFileInputRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx" onChange={handleCreateAssignFileChange} />
                {newAssignmentAttachment.file ? (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <Upload size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate flex-1">{newAssignmentAttachment.file.name}</span>
                    <button type="button" onClick={() => setNewAssignmentAttachment({ file: null, preview: null })} className="text-xs font-bold text-slate-500 hover:text-rose-500">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => createAssignFileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl font-medium text-slate-500 text-sm flex items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/50 transition-colors">
                    <Upload size={16} /> {copy.uploadDocMax || 'Upload document (max 20MB)'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setIsCreateAssignmentModalOpen(false); setNewAssignmentAttachment({ file: null, preview: null }); }} className="flex-1 py-4 text-slate-500 font-bold rounded-2xl">{copy.cancelBtn}</button>
                <button type="submit" className="flex-[2] py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-2xl">{copy.addBtn}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUploadModalOpen && selectedAssignment && (() => {
        const prog = getAssignmentProgress(selectedAssignment);
        const isDone = selectedAssignment.status === 'Completed' || selectedAssignment.status === 'Submitted';
        const dueDate = new Date(selectedAssignment.dueDate + 'T12:00:00');
        const isOverdue = !isDone && dueDate < new Date();
        const daysLeft = Math.ceil((dueDate - new Date()) / 86400000);
        return (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom no-scrollbar">

            {/* Header with colored status band */}
            <div className={`px-6 pt-5 pb-4 ${isDone ? 'bg-emerald-50' : isOverdue ? 'bg-rose-50' : 'bg-violet-50'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl text-white shadow-sm ${isDone ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-violet-500'}`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 leading-tight">{selectedAssignment.title}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-slate-500">{selectedAssignment.subject}</span>
                      <span className="text-slate-300">·</span>
                      <span className={`text-xs font-bold ${selectedAssignment.priority === 'High' ? 'text-rose-500' : selectedAssignment.priority === 'Medium' ? 'text-amber-500' : 'text-slate-400'}`}>{selectedAssignment.priority === 'High' ? copy.priorityHigh : selectedAssignment.priority === 'Medium' ? copy.priorityMedium : copy.priorityLow}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 transition-colors"><X size={18} /></button>
              </div>

              {/* Status + due date row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${isDone ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-white text-slate-600'}`}>
                  {isDone ? <CheckCircle2 size={12} /> : isOverdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                  {isDone ? copy.statusCompleted : isOverdue ? copy.statusOverdue : copy.statusInProgress}
                </span>
                <span className={`text-[11px] font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-500'}`}>
                  {isDone ? `Submitted ${selectedAssignment.submittedAt || ''}` : isOverdue ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) !== 1 ? copy.daysLate : copy.dayLate}` : daysLeft === 0 ? copy.dueToday : daysLeft === 1 ? copy.dueTomorrow : `${copy.dueInDays} ${daysLeft} ${copy.statDays}`}
                </span>
                <span className="text-[11px] text-slate-400 ml-auto">{dueDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{copy.progressLabel}</span>
                  <span className={`text-xs font-black ${prog === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>{prog}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${prog === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`} style={{ width: `${prog}%` }} />
                </div>
              </div>

              {/* Notes */}
              {(() => {
                const teacherReviewed = !!(selectedAssignment.teacherComments || selectedAssignment.grade != null);
                const notesEditable = !isReadOnly && appUser?.role !== ROLES.TEACHER && !teacherReviewed;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{copy.notesSection}</p>
                      {teacherReviewed && <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><Lock size={10} /> Locked after teacher review</span>}
                    </div>
                    {notesEditable ? (
                      <textarea
                        value={selectedAssignment.description || ''}
                        onChange={e => {
                          const updated = { ...selectedAssignment, description: e.target.value };
                          setSelectedAssignment(updated);
                          setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? updated : a));
                        }}
                        placeholder={copy.notesPlaceholder}
                        className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed outline-none resize-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all"
                        rows={3}
                      />
                    ) : (
                      <div className={`p-4 rounded-xl border ${teacherReviewed ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-sm text-slate-600 leading-relaxed">{selectedAssignment.description || copy.notesPlaceholder}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Document */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">{copy.document}</p>
                {selectedAssignment.submittedFile ? (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <div className="p-2 bg-emerald-100 rounded-lg"><Upload size={14} className="text-emerald-600" /></div>
                    <span className="text-sm font-medium text-slate-700 truncate flex-1">{selectedAssignment.submittedFile}</span>
                    {!isReadOnly && (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => { if (!selectedAssignment.submittedPreview) return; const a = document.createElement('a'); a.href = selectedAssignment.submittedPreview; a.download = selectedAssignment.submittedFile || 'document'; a.click(); }} className="px-3 py-1.5 bg-violet-500 text-white font-bold rounded-lg text-xs hover:bg-violet-600 transition-colors">Download</button>
                        <button onClick={() => confirm('Replace the uploaded document? The current file will be removed and the assignment will revert to Pending.', () => { const u = { ...selectedAssignment, submittedFile: null, submittedFileType: null, submittedPreview: null, status: 'Pending' }; setSelectedAssignment(u); setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? u : a)); }, 'danger')} className="px-3 py-1.5 text-slate-500 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors">Replace</button>
                      </div>
                    )}
                  </div>
                ) : (
                  isReadOnly ? <p className="text-sm text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">{copy.noDocUploaded}</p> :
                  <button onClick={() => assignmentFileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl font-medium text-slate-500 text-sm flex items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/50 transition-colors">
                    <Upload size={16} /> {copy.uploadDocMax}
                  </button>
                )}
              </div>

              {/* Grade (if assigned) */}
              {selectedAssignment.grade != null && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">{copy.gradeLabel}</p>
                  <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 px-4 py-2 rounded-xl">
                    <span className="text-xl font-black text-violet-600">{selectedAssignment.grade}</span>
                    <span className="text-xs font-medium text-slate-500">/ 100</span>
                  </div>
                </div>
              )}

              {/* Teacher comments */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><MessageSquare size={12} /> {copy.teacherFeedback}</p>
                {appUser?.role === ROLES.TEACHER ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Grade (optional)</label>
                      <input type="number" min="0" max="100" value={selectedAssignment.grade ?? ''} onChange={(e) => { const v = e.target.value; setSelectedAssignment(prev => ({ ...prev, grade: v === '' ? null : Number(v) })); setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? { ...a, grade: v === '' ? null : Number(v) } : a)); }} placeholder="0–100" className="w-full bg-slate-50 p-3 rounded-xl text-sm font-medium border border-slate-200" />
                    </div>
                    <textarea value={teacherCommentDraft} onChange={(e) => setTeacherCommentDraft(e.target.value)} placeholder="Write a note for the student..." className="w-full bg-slate-50 p-3 rounded-xl text-sm text-slate-700 outline-none resize-none h-20 placeholder:text-slate-400 border border-slate-200 focus:border-violet-400" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveTeacherComment} className="flex-1 py-2.5 bg-violet-600 text-white font-bold rounded-xl text-xs hover:bg-violet-700 transition-colors">Save note</button>
                      <button onClick={() => { if (!teacherCommentDraft.trim()) { showToast('Nothing to log — write a note first', 'info'); return; } confirm('Log this as a formal intervention?', () => { logTeacherIntervention(viewingStudentKey, profileData.email, 'Comment/feedback', teacherCommentDraft); showToast('Intervention logged'); addToHistory('Intervention logged', 'success'); }); }} className="flex-1 py-2.5 bg-amber-100 text-amber-800 font-bold rounded-xl text-xs hover:bg-amber-200 transition-colors">Log intervention</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl">
                    {selectedAssignment.teacherComments ? (
                      <p className="text-sm text-slate-700 leading-relaxed">{selectedAssignment.teacherComments}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">{copy.noFeedback}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Intervention log (teacher only) */}
              {appUser?.role === ROLES.TEACHER && (() => {
                const logs = getInterventionsForStudent(viewingStudentKey).filter(i => i.type === 'intervention_log').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                if (logs.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Activity size={12} /> Intervention log</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                      {logs.slice(0, 10).map(log => (
                        <div key={log.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-violet-600">{log.action}</span>
                            <span className="text-[10px] text-slate-400">{log.date}</span>
                          </div>
                          {log.notes && <p className="text-xs text-slate-600 leading-relaxed">{log.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Sticky footer actions */}
            {!isReadOnly && (
              <div className="px-6 pb-6 pt-2 border-t border-slate-100 flex items-center gap-3">
                {!isDone && (
                  <button onClick={() => confirm(`Mark "${selectedAssignment.title}" as complete?`, () => { const now = getDate(0); setAssignments(prev => prev.map(x => x.id === selectedAssignment.id ? { ...x, status: 'Completed', submittedAt: now } : x)); handleLogCompletion(selectedAssignment, viewingStudentKey); updateRecoveryProgress(viewingStudentKey, 1); setIsUploadModalOpen(false); addToHistory(`Completed: ${selectedAssignment.title}`, 'success'); })} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all">{copy.completeBtn}</button>
                )}
                <button onClick={() => handleDeleteTask(selectedAssignment.id)} className="py-3 px-4 text-rose-500 font-bold rounded-xl text-sm hover:bg-rose-50 transition-colors flex items-center gap-1.5"><Trash2 size={14} /> {copy.removeBtn}</button>
              </div>
            )}

          </div>
        </div>
        );
      })()}

      {isProfileSettingsOpen && (
        <div className="fixed inset-0 z-[400] bg-white flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white pt-safe"><button onClick={() => setIsProfileSettingsOpen(false)} className="p-2 hover:bg-slate-50 rounded-full"><ArrowLeft size={24} className="text-slate-800" /></button><h2 className="text-xl font-bold text-slate-800">{copy.profileTitle}</h2></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => profileImageInputRef.current?.click()}>
                <div className="w-32 h-32 rounded-full bg-violet-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">{profileImage ? <img src={profileImage} className="w-full h-full object-cover" alt="Profile" /> : <User size={56} className="text-violet-300" />}</div>
                <div className="absolute bottom-0 right-0 bg-slate-800 text-white p-2.5 rounded-full shadow-md"><Camera size={18} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Name</label>
                <input type="text" value={profileData.name} onChange={(e) => setProfileData(p => ({ ...p, name: e.target.value }))} placeholder={copy.namePlaceholder} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Role</label>
                <input type="text" value={appUser?.role ?? ''} readOnly disabled className="w-full bg-slate-100 p-4 rounded-2xl font-bold border border-slate-200 text-slate-600 cursor-not-allowed" />
              </div>
              {appUser?.role === ROLES.STUDENT && (
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Grade</label>
                  <select value={profileData.grade} onChange={(e) => setProfileData(p => ({ ...p, grade: e.target.value }))} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none appearance-none cursor-pointer" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23475569' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}>
                    <option value="">Select grade</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={String(g)}>Grade {g}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">School</label>
                <input type="text" value={profileData.school} onChange={(e) => setProfileData(p => ({ ...p, school: e.target.value }))} placeholder={copy.schoolPlaceholder} className="w-full bg-slate-50 p-4 rounded-2xl font-medium border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Email</label>
                <input type="email" value={profileData.email} onChange={(e) => setProfileData(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" className="w-full bg-slate-50 p-4 rounded-2xl font-medium border border-slate-100 focus:ring-2 focus:ring-violet-300 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Gamification</label>
                <select value={profileData.gamificationLevel} onChange={(e) => setProfileData(p => ({ ...p, gamificationLevel: e.target.value }))} disabled={appUser?.role !== ROLES.TEACHER} className={`w-full p-4 rounded-2xl font-medium border border-slate-100 outline-none ${appUser?.role === ROLES.TEACHER ? 'bg-slate-50 focus:ring-2 focus:ring-violet-300' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}>
                  <option value="off">Off</option>
                  <option value="simple">Simple (badges)</option>
                  <option value="full">Full (badges + leaderboard)</option>
                </select>
                {appUser?.role !== ROLES.TEACHER && <p className="text-[10px] text-slate-400 mt-1">Only teachers can change this</p>}
              </div>
              {appUser?.role === ROLES.STUDENT && (
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Favorite subject</label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map(sub => (
                      <button key={sub} type="button" onClick={() => setProfileData(p => ({ ...p, favoriteSubject: p.favoriteSubject === sub ? '' : sub }))} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border ${profileData.favoriteSubject === sub ? 'bg-violet-500 text-white border-violet-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{sub}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-slate-100 flex gap-3">
            <button onClick={() => setIsProfileSettingsOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl">Cancel</button>
            <button onClick={saveProfile} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl">Save</button>
          </div>
        </div>
      )}

      {isCsvImportOpen && !isReadOnly && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black text-slate-800">Import from CSV</h2><button onClick={() => setIsCsvImportOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button></div>
            <p className="text-xs text-slate-500 mb-2">Columns: title, subject, dueDate, status, grade</p>
            <button type="button" onClick={() => csvFileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl font-bold text-slate-600 text-sm flex items-center justify-center gap-2 hover:border-violet-300 hover:bg-violet-50/50 transition-colors mb-3">
              <Upload size={18} /> Choose CSV file
            </button>
            <p className="text-[10px] text-slate-400 text-center mb-2">or paste below</p>
            <textarea value={csvImportText} onChange={(e) => setCsvImportText(e.target.value)} placeholder="title,subject,dueDate,status,grade&#10;Math homework,Math,2025-02-25,Pending,&#10;Read ch 3,English,2025-02-24,Completed,85" className="w-full h-32 p-4 rounded-xl border border-slate-200 text-sm font-mono mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setIsCsvImportOpen(false)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl">Cancel</button>
              <button onClick={() => { const r = parseAssignmentsCSV(csvImportText); if (!r.ok) { addToHistory(r.error || 'Import failed', 'error'); return; } if (!r.items.length) { showToast('No items to import', 'info'); return; } confirm(`Import ${r.items.length} assignment${r.items.length > 1 ? 's' : ''}?`, () => { setAssignments(prev => [...r.items, ...prev]); addToHistory(`Imported ${r.items.length} assignments`, 'success'); showToast(`Imported ${r.items.length} items`); setIsCsvImportOpen(false); setCsvImportText(''); }); }} className="flex-1 py-3 bg-violet-500 text-white font-bold rounded-xl">Import</button>
            </div>
          </div>
        </div>
      )}

      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md h-auto rounded-t-[32px] sm:rounded-[32px] p-6 flex flex-col shadow-2xl duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-slate-800">{copy.filterBy}</h2><button onClick={() => setIsFilterModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button></div>
            <div className="space-y-6 mb-6">
              <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">{copy.colSubject}</label><div className="flex flex-wrap gap-2"><button onClick={() => setFilterSubject('All')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${filterSubject === 'All' ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-600 border-slate-200'}`}>All</button>{subjects.map(sub => (<button key={sub} onClick={() => setFilterSubject(sub)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${filterSubject === sub ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-600 border-slate-200'}`}>{sub}</button>))}</div></div>
            </div>
            <div className="flex gap-3"><button onClick={() => setFilterSubject('All')} className="flex-1 py-3 font-bold text-slate-500">Reset</button><button onClick={() => setIsFilterModalOpen(false)} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl">Apply</button></div>
          </div>
        </div>
      )}
      {isSubscriptionOpen && (() => {
        const activePlan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
        return (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 relative overflow-hidden">

              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Choose your plan</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Upgrade anytime. Cancel anytime.</p>
                </div>
                <button onClick={() => setIsSubscriptionOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={20} /></button>
              </div>

              {/* Plan toggle cards */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUBSCRIPTION_PLANS.map(plan => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedPlan === plan.id
                          ? 'border-violet-500 bg-violet-50/50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full">{plan.badge}</span>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-slate-800">{plan.name}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">{plan.tagline}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selectedPlan === plan.id ? 'bg-violet-500 border-violet-500' : 'border-slate-300'
                        }`}>
                          {selectedPlan === plan.id && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-800">R{plan.price}</span>
                        <span className="text-sm text-slate-400 font-medium">/mo</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feature comparison */}
                <div className="bg-slate-50 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">What's included</p>
                  <div className="space-y-2">
                    {activePlan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        {f.included ? (
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                        ) : (
                          <X size={15} className="text-slate-300 shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${f.included ? 'text-slate-700' : 'text-slate-400'}`}>{f.text}</span>
                        {!f.included && selectedPlan === 'free' && (
                          <span className="text-[9px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded ml-auto">PRO</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust signals */}
                <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium py-1">
                  <span className="flex items-center gap-1"><Lock size={11} /> Secure payment</span>
                  <span>•</span>
                  <span>Cancel anytime</span>
                  <span>•</span>
                  <span>POPIA compliant</span>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="px-6 pb-6 pt-2">
                <button
                  onClick={handleConfirmPlan}
                  disabled={checkoutLoading}
                  className={`w-full py-4 font-black rounded-2xl text-base transition-all disabled:opacity-60 ${
                    selectedPlan === 'free'
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:scale-[1.01]'
                  }`}
                >
                  {checkoutLoading ? 'Redirecting...' : selectedPlan === 'free' ? 'Stay on Free' : `Upgrade to Pro — R${activePlan.price}/mo`}
                </button>
                {selectedPlan !== 'free' && (
                  <p className="text-center text-[11px] text-slate-400 mt-2">You'll be redirected to secure checkout</p>
                )}
                {subscriptionPlan === 'pro' && (
                  <button onClick={() => { setIsSubscriptionOpen(false); setActiveTab(TABS.PAYMENTS); }} className="w-full mt-3 py-2.5 text-slate-500 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors border border-slate-100">
                    Manage or cancel subscription
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
        );
      })()}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[600] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl animate-in zoom-in-95 p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmDialog.variant === 'danger' ? 'bg-rose-100' : 'bg-violet-100'}`}>
              {confirmDialog.variant === 'danger' ? <Trash2 size={22} className="text-rose-500" /> : <CheckCircle2 size={22} className="text-violet-500" />}
            </div>
            <p className="text-sm font-bold text-slate-800 mb-1">Are you sure?</p>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 text-slate-500 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors border border-slate-200">{copy.cancelBtn}</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm transition-colors ${confirmDialog.variant === 'danger' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-violet-500 hover:bg-violet-600'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
