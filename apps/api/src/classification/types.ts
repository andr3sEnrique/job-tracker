import type { EmailCategory, WorkMode } from '@jat/shared';

/** What the classifier sees. Built in memory from Gmail and discarded after processing. */
export interface PreparedEmail {
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  fromDomain: string | null;
  /** Plain text, quoted replies removed, truncated. */
  body: string;
  links: string[];
}

export interface Classification {
  category: EmailCategory;
  confidence: number;
  /** Rule ids that fired, for debugging and evaluation (never contains email text). */
  signals: string[];
}

export interface ExtractedData {
  company: string | null;
  companyConfidence: number;
  role: string | null;
  location: string | null;
  workMode: WorkMode | null;
  jobUrl: string | null;
}

/**
 * The classification port. Phase 5 ships rules; Phase 7 adds an AI implementation behind
 * the same interface (and a composite that only calls the AI when the rules are unsure).
 */
export abstract class EmailClassifier {
  abstract readonly id: string;
  abstract classify(email: PreparedEmail): Classification;
}
