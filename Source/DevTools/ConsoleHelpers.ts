import {CE} from "js-vextensions";
import {accessorMetadata, AccessorMetadata, ProfilingInfo} from "../Accessors/@AccessorMetadata.js";

export function GetAccessorMetadatas() {
	return CE(CE(accessorMetadata).VValues()).OrderByDescending(a=>a.profilingInfo.totalRunTime);
}
export function LogAccessorMetadatas() {
	const metadatas = GetAccessorMetadatas();
	//console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
	console.log(`Accessor cumulative run-times: @TotalCalls(${CE(metadatas.map(a=>a.profilingInfo.callCount)).Sum()})`);
	//Log({}, accessorRunTimes_ordered);
	console.table(metadatas);
}

export function GetAccessorRunInfos() {
	type RunInfo = {name: string} & Omit<ProfilingInfo, "NotifyOfCall">  & {callPlansStored: number, rest: AccessorMetadata};
	//const result = {} as {[key: string]: RunInfo};
	const result = [] as RunInfo[];
	const entries = Array.from(accessorMetadata);
	for (const [key, value] of CE(entries).OrderByDescending(a=>a[1].profilingInfo.totalRunTime)) {
		//result[key] = {callCount: value.callCount, totalRunTime: value.totalRunTime, rest: value};
		result.push({name: key, ...value.profilingInfo, callPlansStored: value.callPlansStored, rest: value});
	}
	return result;
}
export function LogAccessorRunInfos() {
	const runInfos = GetAccessorRunInfos();
	//console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
	console.log(`Accessor cumulative info: @TotalCalls(${CE(runInfos.map(a=>a.callCount)).Sum()})`);
	//Log({}, accessorRunTimes_ordered);
	console.table(runInfos);
}