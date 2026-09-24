import type { Classification, ExtractedData, PreparedEmail } from './types.js';

export interface Analysis {
  classification: Classification;
  extracted: ExtractedData;
  /** Stored on the email: which classifier decided (`rules@3`, `ai:…@prompt-v2`). */
  classifierId: string;
}

/** Classification + extraction of one email: the port the processing pipeline uses. */
export abstract class EmailAnalyzer {
  abstract analyze(email: PreparedEmail, context: { emailId: string }): Promise<Analysis>;
}
