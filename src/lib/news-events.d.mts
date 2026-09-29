export type EventSource = {url:string;title:string;publisher:string;publishedOn:string;reviewedOn:string;basis:'document'|'publisher-summary';scope:string}
export type EventMilestone = {id:string;date:string;dateMeaning:string;title:string;kind:'fact'|'statement'|'analysis';summary:string;context:string;sources:EventSource[]}
export type EventRule = {id:string;label:string;hosts:string[];pathPrefix?:string;any:string[];all:string[];exclude:string[]}
export type EventTrack = {id:string;category:'ai'|'technology'|'finance'|'world';title:string;summary:string;startDate:string;endDate?:string;reviewedOn:string;openQuestions:string[];learning:{label:string;path:string}[];rules:EventRule[];milestones:EventMilestone[]}
export type EventReport = {url:string;title:string;publisher:string;publisherCountry:string;publishedAt:string;firstCollectedAt:string;lastCollectedAt:string;ruleIds:string[];revisionCount:number}
export type EventCoverage = {dailyCollectedAt:string;releasesCollectedAt:string;libraryCollectedAt:string;archiveDates:string[];missingArchiveDates:string[];failedSources:string[];invalidItems:number}
export type EventSnapshot = {version:string;fingerprint:string;coverage:EventCoverage;tracks:{id:string;reports:EventReport[]}[]}
export const EVENT_VERSION:string
export const categoryNames:Record<EventTrack['category'],string>
export const kindNames:Record<EventMilestone['kind'],string>
export function validDay(value:unknown):boolean
export function validTime(value:unknown):boolean
export function canonicalEventUrl(value:unknown):string|null
export function includesTerm(value:string,term:string):boolean
export function validateCatalog(value:unknown):{version:string;tracks:EventTrack[]}
export function validateSnapshot(value:unknown):EventSnapshot
export function matchEventRules(track:EventTrack,item:{url:string;title:string;publishedAt:string}):string[]
export function sortedMilestones(track:EventTrack):EventMilestone[]
export function readEventQuery(params:URLSearchParams,tracks:EventTrack[]):{error?:string;track?:EventTrack;index?:number;source?:string;q?:string}
export function eventQuery(state:{event?:string;step?:string;source?:string;q?:string}):URLSearchParams
export function filteredReports(reports:EventReport[],filters?:{source?:string;q?:string}):EventReport[]
export function freshnessLabel(iso:string,now?:number,days?:number):string
export function eventMarkdown(track:EventTrack,reports:EventReport[],coverage:EventCoverage):string
