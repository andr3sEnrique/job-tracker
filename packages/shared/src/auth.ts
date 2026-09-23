import { z } from 'zod';
export const currentUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
