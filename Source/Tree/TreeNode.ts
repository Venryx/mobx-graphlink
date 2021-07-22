import {FetchResult} from "@apollo/client/core/index.js";
import {Observable} from "@apollo/client/utilities/index.js";
import {Assert, CE, E, ToJSON} from "js-vextensions";
import {observable, ObservableMap, runInAction, _getGlobalState} from "mobx";
import {Graphlink} from "../Graphlink.js";
import {CleanDBData} from "../Utils/DB/DBDataHelpers.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {MaybeLog_Base} from "../Utils/General/General.js";
import {QueryParams, QueryParams_Linked} from "./QueryParams.js";

export enum TreeNodeType {
	Root = "Root",
	Collection = "Collection",
	CollectionQuery = "CollectionQuery",
	Document = "Document",
}

export enum DataStatus {
	Initial = "Initial",
	Waiting = "Waiting",
	Received_Cache = "Received_Cache",
	Received_Full = "Received_Full",
}

export class PathSubscription {
	constructor(unsubscribe: ()=>void) {
		this.unsubscribe = unsubscribe;
	}
	unsubscribe: ()=>void;
}

//export const $varOfSameName = Symbol("$varOfSameName");
export class String_NotWrappedInGraphQL {
	str: string;
	toJSON() {
		return this.str; // don't put quotes around it
	}
}

export class TreeNode<DataShape> {
	constructor(fire: Graphlink<any, any>, pathOrSegments: string | string[]) {
		this.graph = fire;
		this.pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
		this.path = PathOrPathGetterToPath(pathOrSegments)!;
		const queryStr = this.pathSegments.slice(-1)[0]?.startsWith("@query:") ? this.pathSegments.slice(-1)[0].substr("@query:".length) : null;
		this.pathSegments_noQuery = this.pathSegments.filter(a=>!a.startsWith("@query:"));
		this.path_noQuery = this.pathSegments_noQuery.join("/");
		Assert(this.pathSegments.find(a=>a == null || a.trim().length == 0) == null, `Path segments cannot be null/empty. @pathSegments(${this.pathSegments})`);
		this.type = GetTreeNodeTypeForPath(this.pathSegments);
		const query_raw = queryStr ? QueryParams.ParseString(queryStr) : new QueryParams();
		this.query = new QueryParams_Linked({...query_raw, treeNode: this});

		/*if (this.type != TreeNodeType.Root) {
			this.query.treeNode = this;
			this.query.CalculateDerivatives();
		}*/
		if (this.type == TreeNodeType.Document) {
			this.query.varsDefine = ["$id: String!", this.query.varsDefine].filter(a=>a).join(", ");
			//this.query.args_custom = {id: "$id"};
			this.query.args_rawPrefixStr = "id: $id";
			this.query.vars = E({id: this.pathSegments.slice(-1)[0]}, this.query.vars);
			this.query.CalculateDerivatives();
		}
	}
	graph: Graphlink<any, any>;
	pathSegments: string[];
	pathSegments_noQuery: string[];
	path: string;
	path_noQuery: string;
	type: TreeNodeType;

	Request() {
		this.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(this));
		if (!this.subscription) {
			this.Subscribe();
		}
	}
	Subscribe() {
		Assert(this.type != TreeNodeType.Root, "Cannot subscribe to the tree root!");
		Assert(this.subscription == null, "Cannot subscribe more than once!");

		// old: wait till call-stack completes, so we don't violate "can't change observables from within computation" rule
		// we can't change observables from within computed values/funcs/store-accessors, so do it in a moment (out of computation call-stack)
		/*WaitXThenRun(0, ()=> {
			runInAction("TreeNode.Subscribe_prep", ()=>this.status = DataStatus.Waiting);
		});*/
		Assert(_getGlobalState().computationDepth == 0, "Cannot call TreeNode.Subscribe from within a computation.");
		runInAction("TreeNode.Subscribe_prep", ()=>this.status = DataStatus.Waiting);

		MaybeLog_Base(a=>a.subscriptions, ()=>`Subscribing to: ${this.path}`);
		if (this.type == TreeNodeType.Document) {
			this.observable = this.graph.subs.apollo.subscribe({
				query: this.query.GraphQLQuery,
				variables: this.query.vars,
			});
			this.subscription = this.observable.subscribe({
				//start: ()=>{},
				next: data=>{
					const returnedData = data.data; // if requested from top-level-query "map", data.data will have shape: {map: {...}}
					//const returnedDocument = returnedData[Object.keys(this.query.vars!)[0]]; // so unwrap it here
					Assert(Object.values(returnedData).length == 1);
					const returnedDocument = Object.values(returnedData)[0] as any; // so unwrap it here
					MaybeLog_Base(a=>a.subscriptions, l=>l(`Got doc snapshot. @path(${this.path}) @snapshot:`, returnedDocument));
					runInAction("TreeNode.Subscribe.onSnapshot_doc", ()=> {
						this.SetData(returnedDocument, false);
					});
				},
				error: err=>console.error("SubscriptionError:", err),
			});
		} else {
			this.observable = this.graph.subs.apollo.subscribe({
				query: this.query.GraphQLQuery,
				variables: this.query.vars,
			});
			this.subscription = this.observable.subscribe({
				//start: ()=>{},
				next: data=>{
					const docs = data.data[CE(this.pathSegments_noQuery).Last()].nodes;
					Assert(docs != null && docs instanceof Array);
					const fromCache = false;

					MaybeLog_Base(a=>a.subscriptions, l=>l(`Got collection snapshot. @path(${this.path}) @docs:`, docs));
					runInAction("TreeNode.Subscribe.onSnapshot_collection", ()=> {
						const deletedDocIDs = CE(Array.from(this.docNodes.keys())).Exclude(...docs.map(a=>a.id));
						let dataChanged = false;
						for (const doc of docs) {
							if (!this.docNodes.has(doc.id)) {
								this.docNodes.set(doc.id, new TreeNode(this.graph, this.pathSegments.concat([doc.id])));
							}
							//dataChanged = this.docNodes.get(doc.id)!.SetData(doc.data(), fromCache) || dataChanged;
							dataChanged = this.docNodes.get(doc.id)!.SetData(doc, fromCache) || dataChanged;
						}
						for (const docID of deletedDocIDs) {
							const docNode = this.docNodes.get(docID);
							dataChanged = docNode?.SetData(null, fromCache) || dataChanged;
							//docNode?.Unsubscribe(); // if someone subscribed directly, I guess we let them keep the detached subscription?
							this.docNodes.delete(docID);
						}
	
						const newStatus = fromCache ? DataStatus.Received_Cache : DataStatus.Received_Full;
						// see comment in SetData for why we ignore this case
						const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_Cache && this.status == DataStatus.Received_Full;
						if (newStatus != this.status && !isIgnorableStatusChange) {
							this.status = newStatus;
						}
					});
				},
				error: err=>console.error("SubscriptionError:", err),
			});
		}
	}
	Unsubscribe() {
		if (this.observable == null || this.subscription == null) return null;
		let {observable, subscription} = this;
		this.observable = null;
		this.subscription.unsubscribe();
		this.subscription = null;
		return {observable, subscription};
	}
	UnsubscribeAll() {
		this.Unsubscribe();
		this.collectionNodes.forEach(a=>a.UnsubscribeAll());
		this.queryNodes.forEach(a=>a.UnsubscribeAll());
		this.docNodes.forEach(a=>a.UnsubscribeAll());
	}

	@observable status = DataStatus.Initial;
	//subscription: PathSubscription|null;
	observable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>>|null;
	subscription: ZenObservable.Subscription|null;

	// for doc (and root) nodes
	@observable collectionNodes = observable.map<string, TreeNode<any>>();
	//collectionNodes = new Map<string, TreeNode<any>>();
	@observable.ref data: DataShape;
	dataJSON: string;
	SetData(data: DataShape, fromCache: boolean) {
		// this.data being "undefined" is used to signify that it's still loading; so if firebase-given value is "undefined", change it to "null"
		if (data === undefined) {
			data = null as any;
		}

		// Note: with `includeMetadataChanges` enabled, firestore refreshes all subscriptions every half-hour or so. (first with fromCache:true, then with fromCache:false)
		// The checks below are how we keep those refreshes from causing unnecesary subscription-listener triggers. (since that causes unnecessary cache-breaking and UI updating)
		// (if needed, we could just *delay* the update: after X time passes, check if there was a subsequent from-server update that supersedes it -- only propogating the update if there wasn't one)

		const dataJSON = ToJSON(data);
		const dataChanged = dataJSON != this.dataJSON;
		if (dataChanged) {
			//console.log("Data changed from:", this.data, " to:", data, " @node:", this);
			//data = data ? observable(data_raw) as any : null;
			// for graphql system, not currently needed
			CleanDBData(data); //, this.pathSegments);
			this.data = data;
			this.dataJSON = dataJSON;
		}

		const newStatus = fromCache ? DataStatus.Received_Cache : DataStatus.Received_Full;
		const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_Cache && this.status == DataStatus.Received_Full;
		if (newStatus != this.status && !isIgnorableStatusChange) {
			//if (data != null) {
			//ProcessDBData(this.data, true, true, CE(this.pathSegments).Last()); // also add to proxy (since the mobx proxy doesn't expose non-enumerable props) // maybe rework
			this.status = newStatus;
			/*} else {
				// entry was deleted; reset status to "initial"
				this.status = DataStatus.Initial;
			}*/
		}

		return dataChanged;
	}

	// for collection (and collection-query) nodes
	@observable queryNodes = observable.map<string, TreeNode<any>>(); // for collection nodes
	//queryNodes = new Map<string, TreeNode<any>>(); // for collection nodes
	query: QueryParams_Linked; // for collection-query nodes
	@observable docNodes = observable.map<string, TreeNode<any>>();
	//docNodes = new Map<string, TreeNode<any>>();
	get docDatas() {
		// (we need to filter for nodes where data is not nully, since such entries get added by GetDoc(...) calls for non-existent paths, but shouldn't show in docDatas array)
		let docNodes = Array.from(this.docNodes.values()).filter(a=>a.status == DataStatus.Received_Full && a.data != null);
		let docDatas = docNodes.map(docNode=>docNode.data);
		//let docDatas = observable.array(docNodes.map(docNode=>docNode.data));
		return docDatas;
	}

	// default createTreeNodesIfMissing to false, so that it's safe to call this from a computation (which includes store-accessors)
	Get(subpathOrGetterFunc: string | string[] | ((data: DataShape)=>any), query?: QueryParams, createTreeNodesIfMissing = false): TreeNode<any>|null {
		let subpathSegments = PathOrPathGetterToPathSegments(subpathOrGetterFunc);

		let proceed_inAction = ()=>runInAction(`TreeNode.Get @path(${this.path})`, ()=>proceed(true));
		let proceed = (inAction: boolean)=> {
			let currentNode: TreeNode<any> = this;
			for (let [index, segment] of subpathSegments.entries()) {
				let subpathSegmentsToHere = subpathSegments.slice(0, index + 1);
				let childNodesMap = currentNode[currentNode.type == TreeNodeType.Collection ? "docNodes" : "collectionNodes"] as ObservableMap<string, TreeNode<any>>;

				// if tree-node is non-existent, we have to either create it (if permitted), or abort
				if (!childNodesMap.has(segment)) {
					if (!createTreeNodesIfMissing) return null; // if not permitted to create, abort
					if (!inAction) return proceed_inAction(); // if permitted to create, restart function in action (creation must be in action)
					//let pathToSegment = subpathSegments.slice(0, index).join("/");
					childNodesMap.set(segment, new TreeNode(this.graph, this.pathSegments.concat(subpathSegmentsToHere)));
				}

				currentNode = childNodesMap.get(segment)!;
			}

			// if a query is specified, we need to add one additional tree-node (one level deeper) for it
			if (query) {
				// make sure query object is an "actual instance of" QueryParams (else query.toString() will return useless "[object Object]")
				Object.setPrototypeOf(query, QueryParams.prototype);
				query.Clean!(); // query must be cleaned now, before calling "toString()" (the keys need to be consistent)

				// if tree-node is non-existent, we have to either create it (if permitted), or abort
				if (!currentNode.queryNodes.has(query.toString())) {
					if (!createTreeNodesIfMissing) return null; // if not permitted to create, abort
					if (!inAction) return proceed_inAction(); // if permitted to create, restart function in action (creation must be in action)
					currentNode.queryNodes.set(query.toString(), new TreeNode(this.graph, this.pathSegments.concat(subpathSegments).concat("@query:" + query)))
				}

				currentNode = currentNode.queryNodes.get(query.toString())!;
			}

			return currentNode;
		}
		// first, try proceeding without runInAction 
		return proceed(false);
	}

	get raw() { return this.AsRawData(); } // helper for in console
	AsRawData(addTreeLink = true): DataShape {
		return TreeNodeToRawData(this, addTreeLink);
	}
	UploadRawData(rawData: DataShape) {
		// todo
	}
}

export function GetTreeNodeTypeForPath(pathOrSegments: string | string[]) {
	let pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
	if (pathSegments == null || pathSegments.length == 0) return TreeNodeType.Root;
	if (pathSegments.length == 1) return TreeNodeType.Collection;
	if (pathSegments.length == 2 || pathSegments.length == 3) {
		if (CE(pathSegments).Last().startsWith("@query:")) return TreeNodeType.CollectionQuery;
		return TreeNodeType.Document;
	}
	Assert(false, `Invalid TreeNode path. Cannot determine type. @path:${pathOrSegments}`);
	return null as any as TreeNodeType;
	//return pathSegments.length % 2 == 1 ? TreeNodeType.Collection : TreeNodeType.Document;
}
/*export function EnsurePathWatched(opt: FireOptions, path: string, filters?: Filter[]) {
	opt = E(defaultFireOptions, opt);
	let treeNode = opt.fire.tree.Get(path);
	if (treeNode.subscriptions.length) return;
	treeNode.Subscribe(filters ? new QueryParams({filters}) : null);
}*/

export function TreeNodeToRawData<DataShape>(treeNode: TreeNode<DataShape>, addTreeLink = true) {
	let result = {};
	if (addTreeLink) {
		CE(result)._AddItem("_node", treeNode);
	}
	CE(result)._AddItem("_path", treeNode.path);
	/*if (treeNode.data) {
		CE(result).Extend(treeNode.data);
	}*/
	result["data"] = treeNode.data;
	for (let [key, collection] of treeNode.collectionNodes) {
		result[key] = TreeNodeToRawData(collection);
	}
	/*if (treeNode.docNodes) {
		let docsAsRawData = Array.from(treeNode.docNodes.values()).map(docNode=>TreeNodeToRawData(docNode));
		CE(result)._AddItem("_subs", docsAsRawData);
	}*/
	for (let [key, doc] of treeNode.docNodes) {
		result[key] = TreeNodeToRawData(doc);
	}
	return result as DataShape;
}