import { CE } from "js-vextensions";
import { accessorMetadata } from "../Accessors/@AccessorMetadata.js";
export function GetAccessorMetadatas() {
    return CE(CE(accessorMetadata).VValues()).OrderByDescending(a => a.profilingInfo.runTime_sum + a.profilingInfo.waitTime_sum);
}
export function LogAccessorMetadatas() {
    const metadatas = GetAccessorMetadatas();
    //console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
    console.log(`Accessor cumulative run-times: @TotalCalls(${CE(metadatas.map(a => a.profilingInfo.calls)).Sum()})`);
    //Log({}, accessorRunTimes_ordered);
    console.table(metadatas);
}
export function GetAccessorRunInfos() {
    //const result = {} as {[key: string]: RunInfo};
    const result = [];
    const entries = Array.from(accessorMetadata);
    for (const [key, value] of CE(entries).OrderByDescending(a => a[1].profilingInfo.runTime_sum + a[1].profilingInfo.waitTime_sum)) {
        //result[key] = {callCount: value.callCount, totalRunTime: value.totalRunTime, rest: value};
        result.push({ name: key, ...value.profilingInfo, callPlansStored: value.callPlansStored, rest: value });
    }
    return result;
}
export function LogAccessorRunInfos() {
    const runInfos = GetAccessorRunInfos();
    //console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
    console.log(`Accessor cumulative info: @TotalCalls(${CE(runInfos.map(a => a.calls)).Sum()})`);
    //Log({}, accessorRunTimes_ordered);
    console.table(runInfos);
}
