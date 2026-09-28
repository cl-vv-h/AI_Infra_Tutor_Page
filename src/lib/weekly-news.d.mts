import type { WeeklyReportData, DailyNewsData } from '../types/news'
export const weeklyModel: string
export function validDay(day: unknown): day is string
export function shiftDay(day: string, offset: number): string
export function periodDays(start: string, end: string): string[]
export function dueWeek(now?: Date): {start:string;end:string}
export function pendingWeeks(dates:string[], ends:string[], now?:Date): Array<{start:string;end:string;archiveDates:string[]}>
export function weeklyFreshness(report:WeeklyReportData|null, now?:Date): {state:'missing'|'invalid'|'overdue'|'current';expected:{start:string;end:string};missingWeeks:number|null}
export function normalizedSourceUrl(value:string): string
export function reportLinks(content:string): string[]
export function validateWeeklyReport(report:unknown, archives:Record<string,DailyNewsData>, options?:{now?:Date;legacy?:boolean}): string[]
