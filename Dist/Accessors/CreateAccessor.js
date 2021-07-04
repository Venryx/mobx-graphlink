import { CE, E, Assert } from "js-vextensions";
import { defaultGraphOptions } from "../Graphlink.js";
import { storeAccessorCachingTempDisabled, GetWait } from "./Helpers.js";
import { CatchBail } from "../Utils/BailManager.js";
import { AccessorMetadata, accessorMetadata } from "./@AccessorMetadata.js";
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
//export class AccessorOptions<T> {
export class AccessorOptions {
    constructor() {
        this.cache = true;
        this.cache_keepAlive = false;
        //cache_unwrapArgs?: {[key: number]: boolean};
        //cache_unwrapArgs?: number[];
        this.cache_unwrapArrays = true;
    }
}
AccessorOptions.default = new AccessorOptions();
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
export class AccessorContext {
    constructor(graph) {
        this.accessorCallStack = [];
        this.graph = graph;
    }
    get accessorCallStack_current() { return this.accessorCallStack[this.accessorCallStack.length - 1]; }
    // static getters, which return the values for the lowest store-accessor in the stack (assumed to be the level of the code asking for this data)
    //		(if not, eg. if one SA passes func to child SA, then parent SA needs to first cache/unwrap the data it wants, at start of its execution)
    get store() {
        //return AccessorContext.liveValuesStack_current._store;
        return this.graph.storeOverridesStack.length == 0 ? this.graph.rootStore : this.graph.storeOverridesStack.slice(-1)[0];
    }
    ;
    get accessorMeta() {
        return this.accessorCallStack_current.meta;
    }
    get catchItemBails() {
        var _a;
        return (_a = this.accessorCallStack_current.catchItemBails) !== null && _a !== void 0 ? _a : false;
    }
    ;
    get catchItemBails_asX() {
        return this.accessorCallStack_current.catchItemBails_asX;
    }
    ;
    MaybeCatchItemBail(itemGetter) {
        if (this.catchItemBails) {
            return CatchBail(this.catchItemBails_asX, itemGetter);
        }
        return itemGetter();
    }
}
export class AccessorCallStackEntry {
}
/**
Wrap a function with CreateAccessor if it's under the "Store/" path, and one of the following:
1) It accesses the store directly (ie. store.main.page). (thus, "WithStore(testStoreContents, ()=>GetThingFromStore())" works, without hacky overriding of project-wide "store" export)
2) It involves "heavy" processing, such that it's worth caching that processing. (rather than use computedFn directly, just standardize on CreateAccessor)
3) It involves a transformation of data into a new wrapper (ie. breaking reference equality), such that it's worth caching the processing. (to not trigger unnecessary child-ui re-renders)
*/
export const CreateAccessor = (...args) => {
    var _a;
    let name, options, accessorGetter;
    if (typeof args[0] == "function" && args.length == 1)
        [accessorGetter] = args;
    else if (typeof args[0] == "object" && args.length == 2)
        [options, accessorGetter] = args;
    else if (args.length == 2)
        [name, accessorGetter] = args;
    else
        [name, options, accessorGetter] = args;
    name = (_a = name) !== null && _a !== void 0 ? _a : "[name missing]";
    const meta = new AccessorMetadata({ name });
    accessorMetadata.set(name, meta);
    let accessor;
    const wrapperAccessor = (...callArgs) => {
        // initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
        const opt = E(AccessorOptions.default, options);
        let graphOpt = E(defaultGraphOptions, CE(opt).Including("graph"));
        const graph = graphOpt.graph;
        // now that we know what graphlink instance should be used, obtain the actual accessor-func (sending in the graphlink's accessor-context)
        if (accessor == null) {
            accessor = accessorGetter(graph.accessorContext);
            if (name)
                CE(accessor).SetName(name);
        }
        const callStackEntry = { meta, catchItemBails: meta.nextCall_catchItemBails, catchItemBails_asX: meta.nextCall_catchItemBails_asX };
        graph.accessorContext.accessorCallStack.push(callStackEntry);
        callStackEntry._startTime = performance.now();
        let result;
        //graph.accessorContext.accessorCallStack.push(nextCall_catchItemBails ? {catchItemBails: nextCall_catchItemBails, catchItemBails_asX: nextCall_catchItemBails_asX} : AccessorCallStackEntry.default);
        if (meta.nextCall_catchItemBails) {
            meta.nextCall_catchItemBails = false; // reset flag
            //delete meta.nextCall_catchItemBails_asX;
            // also confirm that function actually uses the flag (else, probably an issue, ie. usage forgotten)
            Assert(meta.canCatchItemBails, `${name}.CatchItemBails() called, but accessor seems to contain no bail-catching code. (it neither checks for c.catchItemBails, nor calls c.MaybeCatchItemBail)${""}This suggests a mistake, so either remove the CatchItemBails() call, or add bail-catching code within the accessor-func.`);
        }
        const isRootAccessor = graph.accessorContext.accessorCallStack.length == 1;
        //try {
        if (opt.cache && !storeAccessorCachingTempDisabled) {
            const contextVars = [
                graph.accessorContext.store,
                graph.accessorContext.catchItemBails,
                graph.accessorContext.catchItemBails_asX,
            ];
            result = meta.CallAccessor_OrReturnCache(contextVars, callArgs, opt.cache_unwrapArrays);
        }
        else {
            result = accessor(...callArgs);
        }
        /*} catch (ex) {
            if (ex instanceof BailMessage && isRootAccessor) {
                result = opt.onBail; // if not set, will be "undefined", which is fine (it's traditionally what I've used to indicate "still loading")
            } else {
                throw ex;
            }
        }*/
        const runTime = performance.now() - callStackEntry._startTime;
        meta.callCount++;
        meta.totalRunTime += runTime;
        if (isRootAccessor) {
            meta.totalRunTime_asRoot += runTime;
        }
        graph.accessorContext.accessorCallStack.pop();
        return result;
    };
    // Func.Wait(thing) is shortcut for GetWait(()=>Func(thing))
    // Note: This function doesn't really have a purpose atm, now that "bailing" system is in place.
    wrapperAccessor.Wait = (...callArgs) => {
        // initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
        const opt = E(AccessorOptions.default, options);
        let graphOpt = E(defaultGraphOptions, CE(opt).Including("graph"));
        return GetWait(() => wrapperAccessor(...callArgs), graphOpt);
    };
    wrapperAccessor.CatchBail = (...callArgs) => {
        const bailResultOrGetter = callArgs[0];
        return CatchBail(bailResultOrGetter, wrapperAccessor);
    };
    wrapperAccessor.CatchItemBails = (...callArgs) => {
        const bailResult = callArgs[0];
        meta.nextCall_catchItemBails = true;
        meta.nextCall_catchItemBails_asX = bailResult;
        return CatchBail(bailResult, wrapperAccessor);
    };
    if (name)
        CE(wrapperAccessor).SetName(name);
    return wrapperAccessor;
};
