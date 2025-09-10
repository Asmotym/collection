import { neon } from '@netlify/neon';

export const sql = neon(process.env.DATABASE_URL!);

export * from './queries-handler.core';