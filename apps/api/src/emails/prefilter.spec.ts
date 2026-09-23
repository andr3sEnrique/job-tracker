import { describe, expect, it } from 'vitest';
import { buildGmailSearchQuery, prefilter, type PrefilterInput } from './prefilter.js';

const input = (overrides: Partial<PrefilterInput>): PrefilterInput => ({
  fromEmail: 'someone@example.com',
  fromDomain: 'example.com',
  subject: 'Hola',
  labels: ['INBOX'],
  ownEmail: 'me@gmail.com',
  ...overrides,
});

describe('prefilter', () => {
  it.each([
    ['no-reply@greenhouse.io', 'greenhouse.io', 'ats-sender:greenhouse.io'],
    [
      'notifications@acme.myworkdayjobs.com',
      'acme.myworkdayjobs.com',
      'ats-sender:myworkdayjobs.com',
    ],
    ['noreply@infojobs.net', 'infojobs.net', 'ats-sender:infojobs.net'],
    ['noreply@emails.hellowork.com', 'emails.hellowork.com', 'ats-sender:hellowork.com'],
    ['no-reply@candidates.welcomekit.co', 'candidates.welcomekit.co', 'ats-sender:welcomekit.co'],
  ])('keeps mail from job platforms (%s)', (fromEmail, fromDomain, reason) => {
    expect(prefilter(input({ fromEmail, fromDomain, subject: 'Update' }))).toEqual({
      candidate: true,
      reason,
    });
  });

  it('keeps LinkedIn job mailboxes but not the rest of LinkedIn', () => {
    expect(
      prefilter(input({ fromEmail: 'jobs-noreply@linkedin.com', fromDomain: 'linkedin.com' }))
        .candidate,
    ).toBe(true);
    expect(
      prefilter(
        input({
          fromEmail: 'messages-noreply@linkedin.com',
          fromDomain: 'linkedin.com',
          subject: 'Tienes 3 notificaciones',
        }),
      ),
    ).toEqual({ candidate: false, reason: 'no-signal' });
  });

  it.each([
    ['Tu candidatura para Backend Engineer', 'subject:candidatura'],
    ['Invitación a entrevista', 'subject:entrevista'],
    ['Proceso de selección — siguiente paso', 'subject:proceso de seleccion'],
    ['Your application to Acme', 'subject:application'],
    ['Interview availability', 'subject:interview'],
    ['Votre candidature chez Globex', 'subject:candidature'],
    ['Merci pour votre intérêt', 'subject:merci pour votre interet'],
    ['Opportunity at Acme — quick chat?', 'subject:opportunity'],
    ['Job opportunity: Senior Backend', 'subject:opportunity'],
    ['You are a great candidate for this role', 'subject:candidate'],
    ['Votre profil a retenu notre attention', 'subject:votre profil'],
  ])('keeps job keywords in the subject: %s', (subject, reason) => {
    expect(prefilter(input({ subject }))).toEqual({ candidate: true, reason });
  });

  it('matches whole words only', () => {
    expect(prefilter(input({ subject: 'Reapplication of the paint' })).candidate).toBe(false);
    expect(prefilter(input({ subject: 'Newsletter: positioning your brand' })).candidate).toBe(
      false,
    );
  });

  it('discards sent, spam and trash, whatever the sender', () => {
    expect(prefilter(input({ fromDomain: 'lever.co', labels: ['SENT'] }))).toEqual({
      candidate: false,
      reason: 'label:SENT',
    });
    expect(prefilter(input({ subject: 'Interview', labels: ['SPAM'] })).candidate).toBe(false);
  });

  it('discards messages from the connected mailbox itself', () => {
    expect(prefilter(input({ fromEmail: 'me@gmail.com', subject: 'Re: Interview' }))).toEqual({
      candidate: false,
      reason: 'own-message',
    });
  });

  it('discards everything else', () => {
    expect(prefilter(input({ subject: 'Tu pedido ha sido enviado' }))).toEqual({
      candidate: false,
      reason: 'no-signal',
    });
    expect(prefilter(input({ subject: null }))).toEqual({ candidate: false, reason: 'no-signal' });
  });
});

describe('buildGmailSearchQuery', () => {
  it('limits the window and excludes non-inbox folders', () => {
    const q = buildGmailSearchQuery({ days: 90 });
    expect(q).toMatch(/^newer_than:90d /);
    expect(q).toContain('-in:spam');
    expect(q).toContain('-in:sent');
  });

  it('uses an absolute lower bound for incremental syncs', () => {
    expect(buildGmailSearchQuery({ after: new Date('2026-09-01T00:00:00Z') })).toMatch(
      /^after:1788220800 /,
    );
  });

  it('ORs job senders and subject keywords', () => {
    const q = buildGmailSearchQuery({ days: 30 });
    expect(q).toContain('from:(greenhouse.io OR');
    expect(q).toContain('"proceso de seleccion"');
  });
});
