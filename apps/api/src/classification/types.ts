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

/** Synchronous, local classifier (the rules). The pipeline uses EmailAnalyzer on top. */
export abstract class EmailClassifier {
  abstract readonly id: string;
  abstract classify(email: PreparedEmail): Classification;
}
