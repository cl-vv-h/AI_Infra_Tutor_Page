export type HotspotCategory = 'ai'|'technology'|'finance'|'world'
export type HotspotReport = {id:string;title:string;url:string;source:string;country:string;category:HotspotCategory;publishedAt:string;firstSeenAt:string;lastSeenAt:string}
export type HotspotSource = {name:string;url:string;country:string;state:'ok'|'unavailable'|'invalid';count:number}
export type HotspotCorpus = {version:string;generatedAt:string;startedAt:string;sources:HotspotSource[];items:HotspotReport[]}
export type Hotspot = {id:string;title:string;category:HotspotCategory;kind:'topic'|'story'|'cluster';reports:HotspotReport[];score:number;creditedHeadlines:number;publishers:number;latestAt:string}
export type FollowState = {version:1;entries:{id:string;title:string;seenThrough:string}[]}
export const HOTSPOT_VERSION:string
export const FOLLOW_KEY:string
export const categories:Record<HotspotCategory,string>
export const hotspotTopics:{id:string;title:string;category:HotspotCategory;any:string[];all:string[];sources:string[]}[]
export function matchTopic(item:Pick<HotspotReport,'title'|'source'>):typeof hotspotTopics[number]|undefined
export function publisherFamily(name:string):string
export function hotspotUrl(value:unknown):string|null
export function headlineKey(title:string):string
export function validateHotspotCorpus(data:unknown):HotspotCorpus
export function windowReports(items:HotspotReport[],asOf:string,hours:number):HotspotReport[]
export function heatScore(reports:HotspotReport[],asOf:string):{score:number;creditedHeadlines:number;publishers:number}
export function buildHotspots(corpus:HotspotCorpus,hours?:number):Hotspot[]
export function distribution(items:HotspotReport[],asOf:string):{counts:Record<HotspotCategory,number>;countries:[string,number][];days:string[];matrix:Record<HotspotCategory,number[]>}
export function parseFollows(raw:string|null):FollowState
export function changeFollow(storage:Storage,locks:LockManager|undefined,id:string,title:string,asOf:string,action:'add'|'remove'|'read'):Promise<FollowState>
