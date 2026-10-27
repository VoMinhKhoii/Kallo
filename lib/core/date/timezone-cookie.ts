/**
 * Where the browser leaves its UTC offset for the server to read.
 *
 * A plain module on purpose: the server reads this name, and a value exported
 * from a `'use client'` file reaches a Server Component as a client reference,
 * not the string. When it lived beside the `TimezoneCookie` writer, the logging
 * page's `cookies().get(TIMEZONE_COOKIE)` matched nothing, so its empty-day hint
 * was always unknown and every empty day docked the composer, then jumped it to
 * the centre (layout shift 0.25 on a phone, prod 2026-10-27).
 */
export const TIMEZONE_COOKIE = 'kallo_tzo';
