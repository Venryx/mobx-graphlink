import { CE, E } from "js-vextensions";
import { defaultGraphOptions } from "../Graphlink.js";
import { CatchBail } from "../Utils/General/BailManager.js";
import { AccessorMetadata, accessorMetadata, AccessorOptions } from "./@AccessorMetadata.js";
import { GetAsync, GetWait } from "./Helpers.js";
export function WithStore(options, store, accessorFunc) {
    const opt = E(defaultGraphOptions, options);
    opt.graph.storeOverridesStack.push(store);
    try {
        var result = accessorFunc();
    }
    finally {
        opt.graph.storeOverridesStack.pop();
    }
    return result;
}
// I want to use the approach below, but the TS type-inference for args (after removing the 1st one) is still not perfect; it strips the types of "paramName = defaultVal" entries, and param comments
/*export declare type ArgumentsType_ExceptFirst<F extends (firstArg: any, ...args: any[]) => any> = F extends (firstArg: any, ...args: infer A) => any ? A : never;
export type AccessorWithContext = (context: AccessorContext, ...args: any[])=>any;
export type AccessorWithContext_CallShape<Func extends AccessorWithContext> = ((...args: ArgumentsType_ExceptFirst<Func>)=>ReturnType<Func>);
interface CreateAccessor_Shape2<RootState_PreSet = RootStoreShape> {
    <Func extends AccessorWithContext, RootState = RootState_PreSet>(accessor: Func): AccessorWithContext_CallShape<Func> & FuncExtensions<Func>;
    ...
}*/
/**
Probably temp. Usage:
export const CreateAccessor_Typed = Create_CreateAccessor_Typed<RootStoreShape>();
export const GetPerson = CreateAccessor_Typed({}, ...);
*/
export function Create_CreateAccessor_Typed() {
    // for TS testing of interfaces
    //const a = CreateAccessor(c=>(/** Keep this... */ name: string, /** Keep this 2... */ others = 4)=>"hi");
    //return State_Base as typeof State_Base<RootStateType, any>;
    //return State_Base as StateFunc_WithWatch<RootState>;
    return CreateAccessor;
}
/**
Wrap a function with CreateAccessor if it's under the "Store/" path, and one of the following:
1) It accesses the store directly (ie. store.main.page). (thus, "WithStore(testStoreContents, ()=>GetThingFromStore())" works, without hacky overriding of project-wide "store" export)
2) It involves "heavy" processing, such that it's worth caching that processing. (rather than use computedFn directly, just standardize on CreateAccessor)
3) It involves a transformation of data into a new wrapper (ie. breaking reference equality), such that it's worth caching the processing. (to not trigger unnecessary child-ui re-renders)
*/
export const CreateAccessor = (...args) => {
    let name, options, accessor;
    if (typeof args[0] == "function" && args.length == 1)
        [accessor] = args;
    else if (typeof args[0] == "object" && args.length == 2)
        [options, accessor] = args;
    else if (args.length == 2)
        [name, accessor] = args;
    else
        [name, options, accessor] = args;
    name = name !== null && name !== void 0 ? name : accessor.toString();
    const meta = new AccessorMetadata({
        name,
        options: E(AccessorOptions.default, options),
        accessor,
    });
    accessorMetadata.set(name, meta);
    const opt = meta.options;
    const wrapperAccessor = (...callArgs) => {
        // initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
        //let graphOpt = E(defaultGraphOptions, CE(opt).IncludeKeys("graph"));
        let graphOpt = E(defaultGraphOptions, opt.graph ? { graph: opt.graph } : {});
        const graph = graphOpt.graph;
        const store = graph.storeOverridesStack.length == 0 ? graph.rootStore : graph.storeOverridesStack.slice(-1)[0];
        const allowCacheGetOrSet = opt.cache && !graph.storeAccessorCachingTempDisabled;
        const callPlan = meta.GetCallPlan(graph, store, meta.nextCall_catchItemBails, meta.nextCall_catchItemBails_asX, callArgs, allowCacheGetOrSet);
        meta.ResetNextCallFields();
        let result;
        const startTime = performance.now();
        //const isRootAccessor = graph.accessorContext.accessorCallStack.length == 1;
        const resultIsCached = callPlan.cachedResult_wrapper != null;
        try {
            result = callPlan.Call_OrReturnCache();
        }
        /*catch (ex) {
            if (ex instanceof BailMessage && isRootAccessor) {
                result = opt.onBail; // if not set, will be "undefined", which is fine (it's traditionally what I've used to indicate "still loading")
            } else {
                throw ex;
            }
        }*/
        finally {
            const runTime = performance.now() - startTime;
            meta.profilingInfo.NotifyOfCall(runTime, resultIsCached);
            /*if (isRootAccessor) {
                meta.totalRunTime_asRoot += runTime;
            }*/
            callPlan.callPlanMeta.profilingInfo.NotifyOfCall(runTime, resultIsCached);
        }
        return result;
    };
    /** Func.Async(...) is shortcut for GetAsync(()=>Func(...)) */
    wrapperAccessor.Async = (...callArgs) => {
        // initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
        const opt = E(AccessorOptions.default, options);
        let graphOpt = E(defaultGraphOptions, CE(opt).IncludeKeys("graph"));
        return GetAsync(() => wrapperAccessor(...callArgs), graphOpt);
    };
    // Func.Wait(thing) is shortcut for GetWait(()=>Func(thing))
    // Note: This function doesn't really have a purpose atm, now that "bailing" system is in place.
    wrapperAccessor.Wait = (...callArgs) => {
        // initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
        const opt = E(AccessorOptions.default, options);
        let graphOpt = E(defaultGraphOptions, CE(opt).IncludeKeys("graph"));
        return GetWait(() => wrapperAccessor(...callArgs), graphOpt);
    };
    wrapperAccessor.CatchBail = (bailResultOrGetter, ...callArgs) => {
        return CatchBail(bailResultOrGetter, wrapperAccessor, callArgs);
    };
    wrapperAccessor.CatchItemBails = (bailResult, ...callArgs) => {
        meta.nextCall_catchItemBails = true;
        meta.nextCall_catchItemBails_asX = bailResult;
        return CatchBail(bailResult, wrapperAccessor, callArgs);
    };
    if (name)
        CE(wrapperAccessor).SetName(name);
    return wrapperAccessor;
};
