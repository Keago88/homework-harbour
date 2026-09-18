import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const appSrc = readFileSync(resolve(import.meta.dirname, './App.jsx'), 'utf8');
const authScreen = appSrc.slice(
  appSrc.indexOf('const AuthScreen ='),
  appSrc.indexOf('const SchoolDashboard =')
);

describe('Auth screen CTAs', () => {
  it('does not offer Apple sign-in', () => {
    expect(authScreen).not.toMatch(/Continue with Apple/);
    expect(authScreen).not.toMatch(/Apple sign-in/);
    expect(appSrc).not.toMatch(/OAuthProvider/);
  });

  it('keeps Continue with Google on the shared login/signup form', () => {
    expect(authScreen).toMatch(/Continue with Google/);
    expect(authScreen).toMatch(/onClick=\{handleGoogleSignIn\}/);
    expect(authScreen).toMatch(/New here\? Create account/);
    expect(authScreen).toMatch(/Already have an account\? Sign in/);
  });

  it('keeps email password and email-link flows', () => {
    expect(authScreen).toMatch(/createUserWithEmailAndPassword/);
    expect(authScreen).toMatch(/signInWithEmailAndPassword/);
    expect(authScreen).toMatch(/Continue with email link/);
    expect(authScreen).toMatch(/htmlFor="auth-email"/);
    expect(authScreen).toMatch(/htmlFor="auth-password"/);
  });
});

describe('Google + 14-day trial path', () => {
  it('signs in with Firebase GoogleAuthProvider (popup, then redirect)', () => {
    expect(appSrc).toMatch(/GoogleAuthProvider/);
    expect(appSrc).toMatch(/const handleGoogleSignIn = async/);
    expect(appSrc).toMatch(/signInWithPopup\(auth, provider\)/);
    expect(appSrc).toMatch(/signInWithRedirect\(auth, redirectProvider\)/);
    expect(appSrc).toMatch(/getRedirectResult\(auth\)/);
  });

  it('new Google users share the email-signup trial upsert', () => {
    expect(appSrc).toMatch(/handleGoogleSignIn[\s\S]*onLogin\(/);
    expect(appSrc).toMatch(/const handleB2CLogin = \(userData\) => \{[\s\S]*platformData\.upsertAccount\(uid/);
    expect(appSrc).toMatch(/if \(acct\?\.trialEndsAt\) setTrialEndsAt\(acct\.trialEndsAt\)/);
  });
});
