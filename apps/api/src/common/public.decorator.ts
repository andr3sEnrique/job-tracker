import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global guard. Everything else is protected by default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Opts a route out of the CSRF guard. Only for machine-to-machine endpoints that carry their
 * own credential in a header and never rely on cookies (e.g. the cron endpoint).
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
