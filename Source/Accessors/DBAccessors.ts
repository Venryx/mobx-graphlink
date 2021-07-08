import {CE, E, emptyArray, emptyArray_forLoading} from "js-vextensions";
import {ObservableMap, runInAction} from "mobx";
import {defaultGraphOptions, GraphOptions} from "../Graphlink.js";
import {DataStatus, QueryParams} from "../Tree/TreeNode.js";
import {DBShape} from "../UserTypes.js";
import {Bail, BailMessage} from "../Utils/General/BailManager.js";
import {DoX_ComputationSafe} from "../Utils/General/MobX.js";
import {nil} from "../Utils/General/Nil.js";
import {PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {NotifyWaitingForDB} from "./Helpers.js";

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
export function GetDocs<DB = DBShape, DocT = any>(options: Partial<GraphOptions<any, DB>> & GetDocs_Options, collectionPathOrGetterFunc: string | string[] | ((dbRoot: DB)=>ObservableMap<any, DocT>)): DocT[] {
	const opt = E(defaultGraphOptions, GetDocs_Options.default, options) as GraphOptions & GetDocs_Options;
	let subpathSegments = PathOrPathGetterToPathSegments(collectionPathOrGetterFunc);
	//let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
	let pathSegments = subpathSegments;
	if (CE(pathSegments).Any(a=>a == null)) return emptyArray;

	const treeNode = opt.graph.tree.Get(pathSegments, opt.params);
	// if already subscribed, just mark requested (reduces action-spam of GetDocs_Request)
	if (treeNode && treeNode.subscription) {
		treeNode.Request();
	} else {
		// we can't change observables from within computations, so do it in a moment (out of computation call-stack)
		DoX_ComputationSafe(()=>runInAction("GetDocs_Request", ()=> {
			opt.graph.tree.Get(pathSegments, opt.params, true)!.Request();
		}));
		// we need this function to re-run once new TreeNode is created+subscribed, so access/watch parent TreeNode's collections map
		// edit: nevermind, works without -- since Get function already accesses the collectionNodes field
		//opt.graph.tree.Get(pathSegments.slice(0, -1))?.collectionNodes.entries();
		//opt.graph.tree.collectionNodes.entries();
	}
	
	if (treeNode?.status != DataStatus.Received_Full) {
		NotifyWaitingForDB(pathSegments.join("/"));
		if (opt.ifLoading_bail) {
			Bail(opt.ifLoading_bail_message);
		}
		return opt.ifLoading_returnVal as DocT[];
	}
	/*let docNodes = Array.from(treeNode.docNodes.values());
	let docDatas = docNodes.map(docNode=>docNode.data);
	return docDatas;*/
	//return opt.fire.tree.Get(pathSegments, queryRequest)?.docDatas ?? emptyArray;
	let result = treeNode?.docDatas ?? [];
	return result.length == 0 ? emptyArray : result; // to help avoid unnecessary react renders
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
export function GetDoc<DB = DBShape, DocT = any>(options: Partial<GraphOptions<any, DB>> & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DB)=>DocT)): DocT|null|undefined {
	const opt = E(defaultGraphOptions, GetDoc_Options.default, options) as GraphOptions & GetDoc_Options;
	let subpathSegments = PathOrPathGetterToPathSegments(docPathOrGetterFunc);
	//let pathSegments = opt.inLinkRoot ? opt.graph.rootPathSegments.concat(subpathSegments) : subpathSegments;
	let pathSegments = subpathSegments;
	if (CE(pathSegments).Any(a=>a == null)) return null;

	let treeNode = opt.graph.tree.Get(pathSegments);
	// if already subscribed, just mark requested (reduces action-spam of GetDoc_Request)
	if (treeNode && treeNode.subscription) {
		treeNode.Request();
	} else {
		// we can't change observables from within computations, so do it in a moment (out of computation call-stack)
		DoX_ComputationSafe(()=>runInAction("GetDoc_Request", ()=> {
			opt.graph.tree.Get(pathSegments, undefined, true)!.Request();
		}));
	}

	//if (opt.undefinedForLoading && treeNode?.status != DataStatus.Received_Full) return undefined;
	if (treeNode?.status != DataStatus.Received_Full) {
		NotifyWaitingForDB(pathSegments.join("/"));
		if (opt.ifLoading_bail) {
			Bail(opt.ifLoading_bail_message);
		}
		return opt.ifLoading_returnVal;
	}
	return treeNode?.data;
}
/*export async function GetDoc_Async<DocT>(opt: FireOptions & GetDoc_Options, docPathOrGetterFunc: string | string[] | ((dbRoot: DBShape)=>DocT)): Promise<DocT> {
	opt = E(defaultFireOptions, opt);
	return GetAsync(()=>GetDoc_Async(opt, docPathOrGetterFunc));
}*/
/* GetDocField<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): FieldT {
}
export async GetDocField_Async<DocT, FieldT>(docGetterFunc: (dbRoot: DBShape)=>DocT, fieldGetterFunc: (doc: DocT)=>FieldT, suboptions?: GetDocs_Options): Promise<FieldT> {
} */