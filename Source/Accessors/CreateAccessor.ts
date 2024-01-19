import {Assert, CE, E} from "js-vextensions";
import {defaultGraphRefs, GraphRefs} from "../Graphlink.js";
import {UT_StoreShape} from "../UserTypes.js";
import {BailError, CatchBail} from "../Utils/General/BailManager.js";
import {AccessorCallPlan} from "./@AccessorCallPlan.js";
import {AccessorMetadata, accessorMetadata, AccessorOptions} from "./@AccessorMetadata.js";
import {GetAsync, GetWait} from "./Helpers.js";

export function WithStore<T>(graphRefs: Partial<GraphRefs>, store: any, accessorFunc: ()=>T): T {
	const refs = E(defaultGraphRefs, graphRefs) as GraphRefs;
	refs.graph.storeOverridesStack.push(store);
	try {
		var result = accessorFunc();
	} finally {
		refs.graph.storeOverridesStack.pop();
	}
	return result;
}

/*type Func_WithoutThis<Func> = Func extends ((this: any, ..._: infer Args)=>infer ReturnTypeX)
	? (..._: Args)=>ReturnTypeX
	: never;*/
// these extensions are only present on functions returned by CreateAccessor (see bottom of file)
type FuncExtensions<Func> = {
	Async: Func extends ((..._: infer Args)=>infer ReturnTypeX)
		? (..._: Args)=>Promise<ReturnTypeX>
		: never,
	Wait: Func,
	// other functions, like BIN and BILA, are provided in BailManager.ts as Function.prototype extensions
	CatchBail: Func extends ((..._: infer Args)=>infer ReturnTypeX)
		? <T>(bailResultOrGetter: T, ..._: Args)=>NonNullable<ReturnTypeX> | (T extends (()=>any) ? ReturnType<T> : T)
		: never,
	/*CatchItemBails: Func extends ((..._: infer Args)=>infer ReturnTypeX)
		? <T>(itemBailResult: T, ..._: Args)=>NonNullable<ReturnTypeX> | (T extends (()=>any) ? ReturnType<T> : T)
		: never,*/
};

type AccessInnerFunc_Basic = Function;
type AccessInnerFunc_CtxUsed = (this: AccessorCallPlan, ...args: any[]) => any;
type Options_Ctx0<StoreShape> = Partial<AccessorOptions<StoreShape>> & {ctx?: null|undefined|0};
type Options_Ctx1<StoreShape> = Partial<AccessorOptions<StoreShape>> & {ctx: 1};
/* eslint-disable no-multi-spaces, space-in-parens */
interface CreateAccessor_Shape<StoreShape_PreSet = UT_StoreShape> {
	<Func extends AccessInnerFunc_Basic,   StoreShape = StoreShape_PreSet>(                                                 accessor: Func): Func & FuncExtensions<Func>;
	<Func extends AccessInnerFunc_Basic,   StoreShape = StoreShape_PreSet>(              options: Options_Ctx0<StoreShape>, accessor: Func): Func & FuncExtensions<Func>;
	<Func extends AccessInnerFunc_Basic,   StoreShape = StoreShape_PreSet>(name: string,                                    accessor: Func): Func & FuncExtensions<Func>;
	<Func extends AccessInnerFunc_Basic,   StoreShape = StoreShape_PreSet>(name: string, options: Options_Ctx0<StoreShape>, accessor: Func): Func & FuncExtensions<Func>;

	// Type-helper variants of the above functions (well, those with an options parameter), marking their "this" pseudo-parameters to explicitly be of type "AccessorCallPlan".
	// Helpful for accessors that make use of "this" (ie. the accessor-call-plan/context-object). (see "ctx" param of AccessorOptions for more info)
	// Note: Why have user mark with `{ctx: 1}`, not `(this: AccessorCallPlan)`? This way, explanation is easier to find (just hover over the "ctx" field). Also, less ugly when param comments/inline-doc-text are needed.
	<Func extends AccessInnerFunc_CtxUsed, StoreShape = StoreShape_PreSet>(              options: Options_Ctx1<StoreShape>, accessor: Func): OmitThisParameter<Func> & FuncExtensions<Func>;
	<Func extends AccessInnerFunc_CtxUsed, StoreShape = StoreShape_PreSet>(name: string, options: Options_Ctx1<StoreShape>, accessor: Func): OmitThisParameter<Func> & FuncExtensions<Func>;
}
/* eslint-enable no-multi-spaces, space-in-parens */

/**
Probably temp. Usage:
export const CreateAccessor_Typed = Create_CreateAccessor_Typed<RootStoreShape>();
export const GetPerson = CreateAccessor_Typed({}, ...);
*/
export function Create_CreateAccessor_Typed<StoreShape>() {
	// for TS testing of interfaces
	//const a = CreateAccessor(c=>(/** Keep this... */ name: string, /** Keep this 2... */ others = 4)=>"hi");

	//return State_Base as typeof State_Base<RootStateType, any>;
	//return State_Base as StateFunc_WithWatch<RootState>;
	return CreateAccessor as CreateAccessor_Shape<StoreShape>;
}

/**
Wrap a function with CreateAccessor if it's under the "Store/" path, and one of the following:
1) It accesses the store directly (ie. store.main.page). (thus, "WithStore(testStoreContents, ()=>GetThingFromStore())" works, without hacky overriding of project-wide "store" export)
2) It involves "heavy" processing, such that it's worth caching that processing. (rather than use computedFn directly, just standardize on CreateAccessor)
3) It involves a transformation of data into a new wrapper (ie. breaking reference equality), such that it's worth caching the processing. (to not trigger unnecessary child-ui re-renders)
*/
export const CreateAccessor: CreateAccessor_Shape = (...args)=>{
	let name: string|undefined, options: Partial<AccessorOptions<any>>|null, accessor: Function;
	if (typeof args[0] == "function" && args.length == 1) [accessor] = args;
	else if (typeof args[0] == "object" && args.length == 2) [options, accessor] = args;
	else if (args.length == 2) [name, accessor] = args;
	else [name, options, accessor] = args;

	name = name ?? accessor.name;
	const id = name ?? accessor.toString();
	const meta = new AccessorMetadata({
		name,
		id,
		options: E(AccessorOptions.default, options!),
		accessor,
	});
	accessorMetadata.set(id, meta);
	const opt = meta.options;

	const wrapperAccessor = (...callArgs)=>{
		// initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
		//let accOpt = E(AccessorOptions.default, defaultGraphOptions, CE(opt).IncludeKeys("graph"));
		// overrides are handled this way for performance reasons // edit: I am skeptical that it actually makes a significant difference... (but will leave it alone for now)
		const graphRefs = opt.graph ? E(defaultGraphRefs, {graph: opt.graph}) : defaultGraphRefs;
		const graph = graphRefs.graph;

		const store = graph.storeOverridesStack.length == 0 ? graph.rootStore : graph.storeOverridesStack.slice(-1)[0];
		const allowCacheGetOrSet = opt.cache && !graph.storeAccessorCachingTempDisabled;
		const callPlan = meta.GetCallPlan(graph, store, meta.nextCall_catchItemBails, meta.nextCall_catchItemBails_asX, callArgs, allowCacheGetOrSet);
		meta.ResetNextCallFields();

		let result, error;
		const startTime = globalThis.DEV_DYN ? performance.now() : -1;
		graph.callPlan_callStack.push(callPlan);
		//const isRootAccessor = graph.accessorContext.accessorCallStack.length == 1;
		const resultIsCached = callPlan.cachedResult_wrapper != null;
		try {
			result = callPlan.Call_OrReturnCache();
		} catch (ex) {
			if (ex instanceof BailError) {
				// add more debugging info
				ex["callPlan"] = callPlan;
				if (ex.message == "[generic bail error]") {
					ex.message += `\n@callPlan:${callPlan.toString()}`;
					ex.message += `\n@accessor:${id}`;
				}

				/*if (isRootAccessor) {
					return opt.onBail; // if not set, will be "undefined", which is fine (it's traditionally what I've used to indicate "still loading")
				}*/
				error = ex;
			}
			throw ex;
		} finally {
			graph.callPlan_callStack.pop();

			// You can access this profiling-data from the `accessorMetadata` field, exported from `@AccessorMetadata.ts`
			// Example: `RR.accessorMetadata.VValues().OrderByDescending(a=>a.profilingInfo.runTime_sum)`
			if (globalThis.DEV_DYN) {
				const runTime = performance.now() - startTime;
				meta.profilingInfo.NotifyOfCall(runTime, resultIsCached, error);
				callPlan.callPlanMeta.profilingInfo.NotifyOfCall(runTime, resultIsCached, error);
				/*if (isRootAccessor) {
					meta.totalRunTime_asRoot += runTime;
				}*/
			}
		}

		return result;
	};

	/** Func.Async(...) is shortcut for GetAsync(()=>Func(...)) */
	wrapperAccessor.Async = (...callArgs)=>{
		// initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
		const opt = E(AccessorOptions.default, options!) as Partial<GraphRefs> & AccessorOptions;
		const graphRefs = E(defaultGraphRefs, CE(opt).IncludeKeys("graph"));

		return GetAsync(()=>wrapperAccessor(...callArgs), graphRefs);
	};
	// Func.Wait(thing) is shortcut for GetWait(()=>Func(thing))
	// Note: This function doesn't really have a purpose atm, now that "bailing" system is in place.
	wrapperAccessor.Wait = (...callArgs)=>{
		// initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
		const opt = E(AccessorOptions.default, options!) as Partial<GraphRefs> & AccessorOptions;
		const graphRefs = E(defaultGraphRefs, CE(opt).IncludeKeys("graph"));

		return GetWait(()=>wrapperAccessor(...callArgs), graphRefs);
	};
	wrapperAccessor.CatchBail = (bailResultOrGetter, ...callArgs)=>{
		return CatchBail(bailResultOrGetter, wrapperAccessor, callArgs);
	};
	/*wrapperAccessor.CatchItemBails = (bailResult, ...callArgs)=>{
		meta.nextCall_catchItemBails = true;
		meta.nextCall_catchItemBails_asX = bailResult;
		return CatchBail(bailResult, wrapperAccessor, callArgs);
	};*/

	if (name) CE(wrapperAccessor).SetName(name);
	return wrapperAccessor as any;
};