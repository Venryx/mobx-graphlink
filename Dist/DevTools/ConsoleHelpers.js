import { CE } from "js-vextensions";
import { accessorMetadata } from "../Accessors/@AccessorMetadata.js";
export function GetAccessorMetadatas() {
    return CE(CE(accessorMetadata).VValues()).OrderByDescending(a => a.profilingInfo.runTime_sum + a.profilingInfo.waitTime_sum);
}
export function LogAccessorMetadatas(orderByField = "RunPlusOverheadTime") {
    const metadatas = GetAccessorMetadatas();
    //console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
    console.log(`Accessor cumulative run-times: @TotalCalls(${CE(metadatas.map(a => a.profilingInfo.calls)).Sum()})`);
    //Log({}, accessorRunTimes_ordered);
    let metadatas_ordered = metadatas;
    if (orderByField != null) {
        metadatas_ordered = CE(metadatas_ordered).OrderByDescending(a => {
            if (orderByField == "RunPlusOverheadTime")
                return a.profilingInfo.runTime_sum + a.profilingInfo.overheadTime_sum;
            return a[orderByField];
        });
    }
    const metadatas_ordered_simplified = metadatas_ordered.map(entry => {
        const profilingInfo_props_withFloatsRounded = CE(entry.profilingInfo).Pairs()
            .filter(a => a.key != "currentWaitTime_startedAt")
            .map(pair => {
            if (pair.key.toLowerCase().includes("time")) {
                //pair.value = `${pair.value.toFixed(2)}ms`; // sorting doesn't work if it's turned into a string
                pair.value = pair.value.RoundTo(.01);
            }
            return pair;
        });
        return {
            id: entry.id, // manually define here, so it's displayed first
            ...CE(entry).ExcludeKeys("id", "nextCall_catchItemBails", "nextCall_catchItemBails_asX", "callPlanMetas", "callPlans", "mobxCacheOpts", "profilingInfo", "name", "accessor", "options"),
            //profilingInfo: JSON.stringify(entry.profilingInfo),
            ...CE(profilingInfo_props_withFloatsRounded).ToMapObj(a => a.key, a => a.value),
            RunPlusOverheadTime: entry.profilingInfo.runTime_sum + entry.profilingInfo.overheadTime_sum,
        };
    });
    console.table(metadatas_ordered_simplified);
}
export function GetAccessorRunInfos() {
    //const result = {} as {[key: string]: RunInfo};
    const result = [];
    const entries = Array.from(accessorMetadata);
    for (const [key, value] of CE(entries).OrderByDescending(a => a[1].profilingInfo.runTime_sum + a[1].profilingInfo.waitTime_sum)) {
        //result[key] = {callCount: value.callCount, totalRunTime: value.totalRunTime, rest: value};
        result.push({ name: key, ...value.profilingInfo, callPlansCreated: value.callPlansCreated, rest: value });
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
