import {CE, E, emptyArray, emptyArray_forLoading} from "js-vextensions";
import {ObservableMap, runInAction} from "mobx";
import {defaultGraphOptions, GraphOptions} from "../Graphlink.js";
import {Graphlink} from "../index.js";
import {QueryParams} from "../Tree/QueryParams.js";
import {TreeNodePlaceholder} from "../Tree/TreeRequestWatcher.js";
import {UT_DBShape} from "../UserTypes.js";
import {PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {Bail} from "../Utils/General/BailManager.js";
import {RunInAction_WhenAble, RunInAction} from "../Utils/General/MobX.js";
import {NotifyWaitingForDB} from "./Helpers.js";

export function NotifyRawDBAccess(graph: Graphlink<any, any>) {
	const deepestCallPlanRunning = graph.GetDeepestCallPlanCurrentlyRunning();
	if (deepestCallPlanRunning) {
		deepestCallPlanRunning.accessorMeta.madeRawDBAccess = true;
		deepestCallPlanRunning.callPlanMeta.madeRawDBAccess = true;
	}
}

/*
Why use explicit GetDocs, GetDoc, etc. calls instead of just Proxy's in mobx store fields?
1) It lets you add options (like filters) in a consistent way. (consistent among sync db-accesses, and, old: consistent with async db-accesses, eg. GetDocAsync)
2) It makes it visually clear where a db-access is taking place, as opposed to a mere store access.
*/ 

export class GetDocs_Options {
	static default = new GetDocs_Options();
	inLinkRoot? = true;
	//queryOps?: QueryOp[];
	params?: QueryParams;
	
	ifLoading_bail? = true;
	ifLoading_bail_message?: string;
	ifLoading_returnVal? = emptyArray_forLoading;
	//resultForEmpty? = emptyArray;
}
export function GetDocs<DB = UT_DBShape, DocT = any>(options: Partial<GraphOptions<any, DB>> & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DB)=>ObservableMap<any, DocT>)): DocT[] {
	const opt = E(defaultGraphOptions, GetDocs_Options.default, options) as GraphOptions & GetDocs_Options;
	NotifyRawDBAccess(opt.graph);
	let subpathSegments = PathOrPathGetterToPathSegments(collectionPathOrGetterFunc);
	//let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
	let pathSegments = subpathSegments;
	if (CE(pathSegments).Any(a=>a == null)) return emptyArray;

	// include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
	//opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)

	let treeNode = opt.graph.tree.Get(pathSegments, opt.params);
	// if already subscribed, just mark requested (reduces action-spam of GetDocs_Request)
	if (treeNode && treeNode.self_subscription) {
		treeNode.Request();
	} else {
		// we can't change observables from within computations, so do it in a moment (out of computation call-stack)
		let ranImmediately = RunInAction_WhenAble("GetDocs_Request", ()=>{
			opt.graph.tree.Get(pathSegments, opt.params, true)!.Request();
		});
		if (ranImmediately) {
			treeNode = opt.graph.tree.Get(pathSegments, opt.params);
		} else {
			// if tree-node still not created yet (due to waiting a tick so can start mobx action), add placeholder entry, so tree-request-watchers know there's still data being loaded
			const placeholder = new TreeNodePlaceholder();
			opt.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(placeholder));
		}

		// we need this function to re-run once new TreeNode is created+subscribed, so access/watch parent TreeNode's collections map
		// edit: nevermind, works without -- since Get function already accesses the collectionNodes field
		//opt.graph.tree.Get(pathSegments.slice(0, -1))?.collectionNodes.entries();
		//opt.graph.tree.collectionNodes.entries();
	}

	// always try to access the data (so that the tree-node knows it shouldn't unsubscribe itself)
	let data = treeNode?.DocDatas_ForDirectSubscriber;
	
	if (treeNode == null || !treeNode.PreferredDataContainer.IsDataAcceptableToConsume()) {
		NotifyWaitingForDB(pathSegments.join("/"));
		if (opt.ifLoading_bail) {
			Bail(opt.ifLoading_bail_message);
		}
		return opt.ifLoading_returnVal as DocT[];
	}

	let result = data ?? [];
	if (result.length == 0) result = emptyArray; // to help avoid unnecessary react renders
	return result;
}
/*export async function GetDocs_Async<DocT>(opt: FireOptions & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DBShape)=>ObservableMap<any, DocT>)): Promise<DocT[]> {
	opt = E(defaultFireOptions, opt);
	return GetAsync(()=>GetDocs_Async(opt, collectionPathOrGetterFunc));
}*/

export class GetDoc_Options {
	static default = new GetDoc_Options();
	inLinkRoot? = true;

	ifLoading_bail? = true;
	ifLoading_bail_message?: string;
	ifLoading_returnVal? = undefined;
}
export function GetDoc<DB = UT_DBShape, DocT = any>(options: Partial<GraphOptions<any, DB>> & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DB)=>DocT)): DocT|null|undefined {
	const opt = E(defaultGraphOptions, GetDoc_Options.default, options) as GraphOptions & GetDoc_Options;
	NotifyRawDBAccess(opt.graph);
	let subpathSegments = PathOrPathGetterToPathSegments(docPathOrGetterFunc);
	//let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
	let pathSegments = subpathSegments;
	if (CE(pathSegments).Any(a=>a == null)) return null;

	// include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
	//opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)

	let treeNode = opt.graph.tree.Get(pathSegments);
	// if already subscribed, just mark requested (reduces action-spam of GetDoc_Request)
	if (treeNode && treeNode.self_subscription) {
		treeNode.Request();
	} else {
		// we can't change observables from within computations, so do it in a moment (out of computation call-stack)
		let ranImmediately = RunInAction_WhenAble("GetDoc_Request", ()=>{
			opt.graph.tree.Get(pathSegments, undefined, true)!.Request();
		});
		if (ranImmediately) {
			treeNode = opt.graph.tree.Get(pathSegments);
		} else {
			// if tree-node still not created yet (due to waiting a tick so can start mobx action), add placeholder entry, so tree-request-watchers know there's still data being loaded
			const placeholder = new TreeNodePlaceholder();
			opt.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(placeholder));
		}
	}

	// always try to access the data (so that the tree-node knows it shouldn't unsubscribe itself)
	let data = treeNode?.Data_ForDirectSubscriber;

	if (treeNode == null || !treeNode.PreferredDataContainer.IsDataAcceptableToConsume()) {
		NotifyWaitingForDB(pathSegments.join("/"));
		if (opt.ifLoading_bail) {
			Bail(opt.ifLoading_bail_message);
		}
		return opt.ifLoading_returnVal;
	}

	return data;
}
/*export async function GetDoc_Async<DocT>(opt: FireOptions & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DBShape)=>DocT)): Promise<DocT> {
	opt = E(defaultFireOptions, opt);
	return GetAsync(()=>GetDoc_Async(opt, docPathOrGetterFunc));
}*/
/* GetDocField<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): FieldT {
}
export async GetDocField_Async<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): Promise<FieldT> {
} */