import {CE, E, emptyArray, emptyArray_forLoading} from "js-vextensions";
import {ObservableMap, runInAction} from "mobx";
import {defaultGraphRefs, GraphRefs} from "../Graphlink.js";
import {Graphlink, PathSegmentsAreValid, TreeNode} from "../index.js";
import {QueryParams} from "../Tree/QueryParams.js";
import {TreeNodePlaceholder} from "../Tree/TreeRequestWatcher.js";
import {UT_DBShape} from "../UserTypes.js";
import {PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {Bail} from "../Utils/General/BailManager.js";
import {RunInAction_WhenAble, RunInAction, MobX_AllowStateChanges} from "../Utils/General/MobX.js";

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
export function GetDocs<DB = UT_DBShape, DocT = any>(options: Partial<GraphRefs<any, DB>> & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DB)=>ObservableMap<any, DocT>)): DocT[] {
	const opt = E(defaultGraphRefs, GetDocs_Options.default, options) as GraphRefs & GetDocs_Options;
	if (!opt.graph.initialized) return opt.ifLoading_returnVal as DocT[];

	NotifyRawDBAccess(opt.graph);
	const pathSegments = PathOrPathGetterToPathSegments(collectionPathOrGetterFunc);
	if (opt.params != null && Object.getOwnPropertyNames(opt.params).length > 0) {
		QueryParams.Clean(opt.params);
		pathSegments.push(`@query:${QueryParams.ToJSON(opt.params)}`);
	}
	if (!PathSegmentsAreValid(pathSegments)) return emptyArray;

	// include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
	//opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)

	let treeNode: TreeNode<any>|null = null;
	if (MobX_AllowStateChanges()) {
		treeNode = opt.graph.tree.Get(pathSegments, true)!;
		treeNode.Request();
	} else {
		treeNode = opt.graph.tree.Get(pathSegments, false);
		if (treeNode) {
			treeNode.MarkRequested();
		} else {
			// if no tree-node exists at target path, and we can't attach one atm, then add placeholder to "nodesRequested" set (so tree-request-watchers know there's still data being loaded)
			const placeholder = new TreeNodePlaceholder(pathSegments.join("/"));
			opt.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(placeholder));
		}

		// ensure a full attach+request is completed (in a moment, out of computation call-stack; we can't change observables from within computations)
		const inDataCommitChain_preWait = opt.graph.inDataCommitChain;
		let inDataCommitChain_afterWait: boolean;
		RunInAction_WhenAble("GetDocs_Request", ()=>{
			inDataCommitChain_afterWait = opt.graph.inDataCommitChain;
			if (inDataCommitChain_preWait) opt.graph.inDataCommitChain = inDataCommitChain_preWait;
			opt.graph.tree.Get(pathSegments, true)!.Request();
		}, ()=>opt.graph.inDataCommitChain = inDataCommitChain_afterWait);
	}

	// always try to access the data (so that the tree-node knows it shouldn't unsubscribe itself), and the status (through preferred data-container)
	const data = treeNode?.DocDatas_ForDirectSubscriber;
	const dataAcceptableToConsume = treeNode?.PreferredDataContainer.IsDataAcceptableToConsume();

	if (!dataAcceptableToConsume) {
		if (opt.ifLoading_bail) {
			const bailMessage = opt.ifLoading_bail_message ?? `Data not yet loaded at path "${pathSegments.join("/")}", and this call-path has no bail-handler.`; // no bail-handler IF message seen in ui
			Bail(bailMessage);
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
export function GetDoc<DB = UT_DBShape, DocT = any>(options: Partial<GraphRefs<any, DB>> & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DB)=>DocT)): DocT|null|undefined {
	const opt = E(defaultGraphRefs, GetDoc_Options.default, options) as GraphRefs & GetDoc_Options;
	if (!opt.graph.initialized) return opt.ifLoading_returnVal;

	NotifyRawDBAccess(opt.graph);
	const pathSegments = PathOrPathGetterToPathSegments(docPathOrGetterFunc);
	if (!PathSegmentsAreValid(pathSegments)) return null;

	// include a mobx-access of user-info; this way, the accessor-stack is refreshed when user-info changes (which we want, since RLS policies can cause results to change depending on user-info)
	//opt.graph.userInfo; // commented; not actually needed (the tree-nodes reset will trigger the accessor-stacks to refresh anyway)

	let treeNode: TreeNode<any>|null = null;
	if (MobX_AllowStateChanges()) {
		treeNode = opt.graph.tree.Get(pathSegments, true)!;
		treeNode.Request();
	} else {
		treeNode = opt.graph.tree.Get(pathSegments, false);
		if (treeNode) {
			treeNode.MarkRequested();
		} else {
			// if no tree-node exists at target path, and we can't attach one atm, then add placeholder to "nodesRequested" set (so tree-request-watchers know there's still data being loaded)
			const placeholder = new TreeNodePlaceholder(pathSegments.join("/"));
			opt.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(placeholder));
		}

		// ensure a full attach+request is completed (in a moment, out of computation call-stack; we can't change observables from within computations)
		const inDataCommitChain_preWait = opt.graph.inDataCommitChain;
		let inDataCommitChain_afterWait: boolean;
		RunInAction_WhenAble("GetDoc_Request", ()=>{
			inDataCommitChain_afterWait = opt.graph.inDataCommitChain;
			if (inDataCommitChain_preWait) opt.graph.inDataCommitChain = inDataCommitChain_preWait;
			opt.graph.tree.Get(pathSegments, true)!.Request();
		}, ()=>opt.graph.inDataCommitChain = inDataCommitChain_afterWait);
	}

	// always try to access the data (so that the tree-node knows it shouldn't unsubscribe itself), and the status (through preferred data-container)
	const data = treeNode?.Data_ForDirectSubscriber;
	const dataAcceptableToConsume = treeNode?.PreferredDataContainer.IsDataAcceptableToConsume();

	if (!dataAcceptableToConsume) {
		if (opt.ifLoading_bail) {
			const bailMessage = opt.ifLoading_bail_message ?? `Data not yet loaded at path "${pathSegments.join("/")}", and this call-path has no bail-handler.`; // no bail-handler IF message seen in ui
			Bail(bailMessage);
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