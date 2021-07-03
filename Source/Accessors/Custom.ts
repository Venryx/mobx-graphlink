import {computedFn} from "mobx-utils";
import {CE, ObjectCE, E, Assert} from "js-vextensions";
import {GraphOptions, defaultGraphOptions, Graphlink} from "../Graphlink.js";
import {RootStoreShape} from "../UserTypes.js";
import {storeAccessorCachingTempDisabled, GetWait, AssertV} from "./Helpers.js";
import {g} from "../Utils/@PrivateExports.js";
import {ArgumentsType} from "updeep/types/types";
import {CatchBail} from "../Utils/BailManager.js";
import {AccessorCache, GetAccessorCache} from "./CacheManager.js";

// for profiling
class AccessorProfileData {
	constructor(name: string) {
		this.name = name;
		// make names the same length, for easier scanning in console listing // not needed for console.table
		//this.name = _.padEnd(name, 50, " ");
		this.callCount = 0;
		this.totalRunTime = 0;
		this.totalRunTime_asRoot = 0;
	}
	name: string;
	callCount: number;
	totalRunTime: number;
	totalRunTime_asRoot: number;
	//origAccessors: Function[];
}
export const accessorProfileData = {} as {[key: string]: AccessorProfileData};
export function LogAccessorRunTimes() {
	const accessorRunTimes_ordered = CE(CE(accessorProfileData).VValues()).OrderByDescending(a=>a.totalRunTime);
	console.log(`Store-accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
	//Log({}, accessorRunTimes_ordered);
	console.table(accessorRunTimes_ordered);
}

export function WithStore<T>(options: Partial<GraphOptions>, store: any, accessorFunc: ()=>T): T {
	const opt = E(defaultGraphOptions, options) as GraphOptions;
	opt.graph.storeOverridesStack.push(store);
	try {
		var result = accessorFunc();
	} finally {
		opt.graph.storeOverridesStack.pop();
	}
	return result;
}

// for profiling
export const accessorStack = [] as string[];

//export class AccessorOptions<T> {
export class AccessorOptions {
	static default = new AccessorOptions();
	cache = true;
	cache_keepAlive = false;
	//cache_unwrapArgs?: {[key: number]: boolean};
	//cache_unwrapArgs?: number[];
	cache_unwrapArrays = true;
	//callArgToDependencyConvertorFunc?: CallArgToDependencyConvertorFunc;

	/** Short for bail-result. */
	//onBail: T;
	onBail: any;
}
export type CallArgToDependencyConvertorFunc = (callArgs: any[])=>any[];

type WithNonNullableReturnType<Func> =
	Func extends ((..._: infer Args)=>infer ReturnTypeX)
		? (..._: Args)=>NonNullable<ReturnTypeX>
		: Func;
type BailCatcher<Func> = Func extends ((..._: infer Args)=>infer ReturnTypeX)
	? <T>(bailResultOrGetter: T, ..._: Args)=>NonNullable<ReturnTypeX> | (T extends (()=>any) ? ReturnType<T> : T)
	: Func;
type FuncExtensions<Func> = {
	Wait: Func,
	/*#* Short for "bail if null". */
	//BIN: WithNonNullableReturnType<Func>,
	CatchBail: BailCatcher<Func>,
	//CatchItemBails: ItemBailCatcher<Func>, // was same as BailCatcher, but with different arg-name
	CatchItemBails: BailCatcher<Func>,
};

// I want to use these to extract out the typing, but then it makes the metadata harder to understand for library users
/*type CA_Accessor<Func, RootState> = (context: AccessorContext<RootState>)=>Func;
type CA_ReturnType<Func> = Func & FuncExtensions<Func>;*/
type CA_Options<RootState> = Partial<GraphOptions<RootState> & AccessorOptions>;
interface CreateAccessor_Shape<RootState_PreSet = RootStoreShape> {
	<Func extends Function, RootState = RootState_PreSet>(																accessorGetter: (context: AccessorContext<RootState>)=>Func): Func & FuncExtensions<Func>;
	<Func extends Function, RootState = RootState_PreSet>(options: CA_Options<RootState>,						accessorGetter: (context: AccessorContext<RootState>)=>Func): Func & FuncExtensions<Func>;
	<Func extends Function, RootState = RootState_PreSet>(name: string,												accessorGetter: (context: AccessorContext<RootState>)=>Func): Func & FuncExtensions<Func>;
	<Func extends Function, RootState = RootState_PreSet>(name: string, options: CA_Options<RootState>,	accessorGetter: (context: AccessorContext<RootState>)=>Func): Func & FuncExtensions<Func>;
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
export function Create_CreateAccessor_Typed<RootState>() {
	// for TS testing of interfaces
	//const a = CreateAccessor(c=>(/** Keep this... */ name: string, /** Keep this 2... */ others = 4)=>"hi");

	//return State_Base as typeof State_Base<RootStateType, any>;
	//return State_Base as StateFunc_WithWatch<RootState>;
	return CreateAccessor as CreateAccessor_Shape<RootState>;
}

export class AccessorContext<RootStoreShape> {
	constructor(graph: Graphlink<RootStoreShape, any>) {
		this.graph = graph;
	}
	
	graph: Graphlink<RootStoreShape, any>;
	liveValuesStack = [] as {catchItemBailsAsNulls?: boolean}[];
	get liveValuesStack_current() { return this.liveValuesStack[this.liveValuesStack.length - 1]; }

	// static getters, which return the values for the lowest store-accessor in the stack (assumed to be the level of the code asking for this data)
	//		(if not, eg. if one SA passes func to child SA, then parent SA needs to first cache/unwrap the data it wants, at start of its execution)
	get store(): RootStoreShape {
		//return AccessorContext.liveValuesStack_current._store;
		return this.graph.storeOverridesStack.length == 0 ? this.graph.rootStore : this.graph.storeOverridesStack.slice(-1)[0];
	};
	get catchItemBailsAsNulls(): boolean {
		return this.liveValuesStack_current.catchItemBailsAsNulls ?? false;
	};
}
const AccessorContext_liveValueSet_presets = {
	catchItemBailsAsNulls_true: {catchItemBailsAsNulls: true},
	catchItemBailsAsNulls_false: {catchItemBailsAsNulls: false},
};

/**
Wrap a function with CreateAccessor if it's under the "Store/" path, and one of the following:
1) It accesses the store directly (ie. store.main.page). (thus, "WithStore(testStoreContents, ()=>GetThingFromStore())" works, without hacky overriding of project-wide "store" export)
2) It involves "heavy" processing, such that it's worth caching that processing. (rather than use computedFn directly, just standardize on CreateAccessor)
3) It involves a transformation of data into a new wrapper (ie. breaking reference equality), such that it's worth caching the processing. (to not trigger unnecessary child-ui re-renders)
*/
export const CreateAccessor: CreateAccessor_Shape = (...args)=> {
	let name: string, options: Partial<GraphOptions & AccessorOptions>|null, accessorGetter: Function;
	if (typeof args[0] == "function" && args.length == 1) [accessorGetter] = args;
	else if (typeof args[0] == "object" && args.length == 2) [options, accessorGetter] = args;
	else if (args.length == 2) [name, accessorGetter] = args;
	else [name, options, accessorGetter] = args;
	name = name! ?? "[name missing]";

	//let addProfiling = manager.devEnv; // manager isn't populated yet
	const addProfiling = g["DEV"];
	//const needsWrapper = addProfiling || options.cache;

	let accessor: Function|undefined;
	let accessorCache: AccessorCache;
	let nextCall_catchItemBails = false;
	const wrapperAccessor = (...callArgs)=>{
		// initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
		const opt = E(AccessorOptions.default, options!) as Partial<GraphOptions> & AccessorOptions;
		let graphOpt = E(defaultGraphOptions, CE(opt).Including("graph"));
		const graph = graphOpt.graph;

		// now that we know what graphlink instance should be used, obtain the actual accessor-func (sending in the graphlink's accessor-context)
		if (accessor == null) {
			accessor = accessorGetter(graph.accessorContext) as Function;
			if (name) CE(accessor).SetName(name);
			accessorCache = GetAccessorCache(accessor, {keepAlive: opt.cache_keepAlive});
		}

		if (addProfiling) {
			accessorStack.push(name ?? "n/a");

			var startTime = performance.now();
			//return accessor.apply(this, callArgs);
		}

		let result;
		//graph.accessorContext.liveValuesStack.push({catchItemBailsAsNulls: nextCall_catchItemBails})
		graph.accessorContext.liveValuesStack.push(AccessorContext_liveValueSet_presets[`catchItemBailsAsNulls_${nextCall_catchItemBails}`]);
		if (nextCall_catchItemBails) nextCall_catchItemBails = false; // reset flag
		if (opt.cache && !storeAccessorCachingTempDisabled) {
			const contextVars = [
				graph.accessorContext.store,
				graph.accessorContext.catchItemBailsAsNulls
			];
			result = accessorCache.CallAccessor_OrReturnCache(contextVars, callArgs, opt.cache_unwrapArrays);
		} else {
			result = accessor(...callArgs);
		}
		graph.accessorContext.liveValuesStack.pop();

		if (addProfiling) {
			const runTime = performance.now() - startTime!;

			const profileData = accessorProfileData[name] || (accessorProfileData[name] = new AccessorProfileData(name));
			profileData.callCount++;
			profileData.totalRunTime += runTime;
			if (accessorStack.length == 1) {
				profileData.totalRunTime_asRoot += runTime;
			}
			// name should have been added by webpack transformer, but if not, give some info to help debugging (under key "null")
			if (name == "[name missing]") {
				profileData["origAccessors"] = profileData["origAccessors"] || [];
				if (!profileData["origAccessors"].Contains(accessorGetter)) {
					profileData["origAccessors"].push(accessorGetter);
				}
			}

			CE(accessorStack).RemoveAt(accessorStack.length - 1);
		}

		return result;
	};

	// Func.Wait(thing) is shortcut for GetWait(()=>Func(thing))
	// Note: This function doesn't really have a purpose atm, as Command.Validate functions already use a GetAsync wrapper that quick-throws as soon as any db-request has to wait.
	wrapperAccessor.Wait = (...callArgs)=>{
		// initialize these in wrapper-accessor rather than root-func, because defaultFireOptions is usually not ready when root-func is called
		const opt = E(AccessorOptions.default, options!) as Partial<GraphOptions> & AccessorOptions;
		let graphOpt = E(defaultGraphOptions, CE(opt).Including("graph"));

		return GetWait(()=>wrapperAccessor(...callArgs), graphOpt);
	};
	// this is kind of a "lighter" version of Func.Wait; rather than check if any db-paths are being waited for, it confirms that the result is non-null, erroring otherwise (so similar, but not exactly the same)
	// (we override Function.NN from jsve, so we can call AssertV instead, and for a slightly more specific error message)
	/*wrapperAccessor.NN = (...callArgs)=>{
		const result = wrapperAccessor(...callArgs);
		AssertV(result != null, `Store-accessor "${wrapperAccessor.name}" returned ${result}. Since this violates a non-null type-guard, an error has been thrown; the caller will try again once the underlying data changes.`);
		return result;
	};*/

	wrapperAccessor.CatchBail = (...callArgs)=>{
		const bailResultOrGetter = callArgs[0];
		return CatchBail(bailResultOrGetter, wrapperAccessor);
	};
	wrapperAccessor.CatchItemBails = (...callArgs)=>{
		const bailResultOrGetter = callArgs[0];
		nextCall_catchItemBails = true;
		return CatchBail(bailResultOrGetter, wrapperAccessor);
	};

	//if (name) wrapperAccessor["displayName"] = name;
	//if (name) Object.defineProperty(wrapperAccessor, "name", {value: name});
	if (name) CE(wrapperAccessor).SetName(name);
	return wrapperAccessor as any;
};