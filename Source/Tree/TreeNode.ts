import {Assert, AssertWarn, CE, E, Timer, ToJSON} from "js-vextensions";
import {computed, makeObservable, observable, ObservableMap, onBecomeObserved, onBecomeUnobserved, runInAction, _getGlobalState} from "mobx";
import {Graphlink} from "../Graphlink.js";
import {FetchResult, Observable, ObservableSubscription} from "@apollo/client";
import {CleanDBData} from "../Utils/DB/DBDataHelpers.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {MaybeLog_Base} from "../Utils/General/General.js";
import {RunInAction_WhenAble, makeObservable_safe, MobX_AllowStateChanges, MobX_GetGlobalState, RunInAction, RunInNextTick_BundledInOneAction} from "../Utils/General/MobX.js";
import {QueryParams, QueryParams_Linked} from "./QueryParams.js";
import {DataStatus, GetPreferenceLevelOfDataStatus, TreeNodeData} from "./TreeNodeData.js";

export enum TreeNodeType {
	Root = "Root",
	Collection = "Collection",
	CollectionQuery = "CollectionQuery",
	Document = "Document",
}

export enum SubscriptionStatus {
	Initial = "Initial",
	Waiting = "Waiting",
	ReadyAndLive = "ReadyAndLive",
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

// for debugging
export const nodesByPath = new Map<String, TreeNode<any>[]>();

export function PathSegmentsAreValid(pathSegments: string[]) {
	return pathSegments.every(a=>a != null && a.trim().length > 0);
}

export class TreeNode<DataShape> {
	constructor(graph: Graphlink<any, any>, pathOrSegments: string | string[]) {
		graph.allTreeNodes.add(this);
		makeObservable_safe(this, {
			// special proxy-fields
			Data_ForDirectSubscriber: computed,
			DocDatas_ForDirectSubscriber: computed,
			// data
			self_subscriptionStatus: observable,
			/*data_fromParent: observable.ref,
			data_fromSelf: observable.ref,*/
			PreferredDataContainer: computed,
			//PreferredDataStatus: computed,
			PreferredData: computed,
			DocDatas: computed,
			// hierarchy
			collectionNodes: observable,
			queryNodes: observable,
			docNodes: observable,
		});
		this.graph = graph;
		this.pathSegments = PathOrPathGetterToPathSegments(pathOrSegments);
		this.path = PathOrPathGetterToPath(pathOrSegments)!;
		const queryStr = this.pathSegments.slice(-1)[0]?.startsWith("@query:") ? this.pathSegments.slice(-1)[0].substr("@query:".length) : null;
		this.pathSegments_noQuery = this.pathSegments.filter(a=>!a.startsWith("@query:"));
		this.path_noQuery = this.pathSegments_noQuery.join("/");
		Assert(PathSegmentsAreValid(this.pathSegments), `Path segments cannot be null/empty. @pathSegments(${this.pathSegments})`);
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

		const oldNodesOnPath = nodesByPath.get(this.path) ?? [];
		//Assert(oldNodesOnPath.length == 0, `Found another TreeNode with the exact same path! @path:${this.path}`);
		AssertWarn(oldNodesOnPath.filter(a=>a.self_subscription != null).length == 0, `Found another TreeNode with the exact same path, with a live subscription! @path:${this.path}`);
		nodesByPath.set(this.path, oldNodesOnPath.concat(this));

		this.countSecondsWithoutObserver_timer = new Timer(this.graph.unsubscribeTreeNodesAfter, ()=>{
			/*if (this.path_noQuery == "commandRuns/J5Vk5OYCRi-7tP6XtEBTQg") {
				let a = "test1";
			}
			console.log("At timer end... @path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);*/

			// defensive; cancel unsubscribe if somehow we still have observers
			if (this.observedDataFields.size > 0) return;
			this.Unsubscribe();
			// todo: probably detach/completely-remove TreeNodes, in this case (to free up memory and such)
		}, 1);
		const OnDataFieldObservedStateChange = (field: string, newObservedState: boolean)=>{
			/*if (this.path_noQuery == "commandRuns/J5Vk5OYCRi-7tP6XtEBTQg") {
				let a = "test2";
			}*/

			if (newObservedState) {
				this.observedDataFields.add(field);
			} else {
				this.observedDataFields.delete(field);
			}
			//console.log("@path:", this.path, "@observedDataFields.size:", this.observedDataFields.size);

			if (this.observedDataFields.size == 0) {
				if (this.graph.unsubscribeTreeNodesAfter != -1) {
					this.countSecondsWithoutObserver_timer.Start();
				}
			} else {
				this.countSecondsWithoutObserver_timer.Stop();
				if (this.self_subscription == null) {
					RunInAction("TreeNode.OnDataFieldObservedStateChange.Resubscribe", ()=>{
						this.Subscribe();
					});
				}
			}
		};
		onBecomeObserved(this, "Data_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("Data_ForDirectSubscriber", true));
		onBecomeUnobserved(this, "Data_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("Data_ForDirectSubscriber", false));
		onBecomeObserved(this, "DocDatas_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("DocDatas_ForDirectSubscriber", true));
		onBecomeUnobserved(this, "DocDatas_ForDirectSubscriber", ()=>OnDataFieldObservedStateChange("DocDatas_ForDirectSubscriber", false));
		// just because a TreeNode was created, does not mean anyone is actually mobx-observing it; so start the unsubscribe timer as soon as it's created
		if (this.graph.unsubscribeTreeNodesAfter != -1) {
			this.countSecondsWithoutObserver_timer.Start();
		}
	}
	observedDataFields = new Set<String>();
	countSecondsWithoutObserver_timer: Timer;
	// these are special proxies, that we use merely to keep track of if there are GetDoc/GetDocs calls still observing the given source-fields
	get Data_ForDirectSubscriber() { // [@computed]
		return this.PreferredData;
	}
	get DocDatas_ForDirectSubscriber() { // [@computed]
		return this.DocDatas;
	}

	graph: Graphlink<any, any>;
	pathSegments: string[];
	pathSegments_noQuery: string[];
	path: string;
	path_noQuery: string;
	type: TreeNodeType;

	get ParentNode() {
		return this.graph.tree.Get(this.pathSegments.slice(0, -1));
	}

	MarkRequested() {
		this.graph.treeRequestWatchers.forEach(a=>a.nodesRequested.add(this));
	}
	Request(subscribeIfNotAlready = true) {
		this.MarkRequested();
		if (subscribeIfNotAlready && !this.self_subscription) {
			this.Subscribe();
		}
	}
	/** Must be called from within a mobx action. (and not be run within a mobx computation) */
	Subscribe() {
		Assert(this.type != TreeNodeType.Root, "Cannot subscribe to the tree root!");
		Assert(this.self_subscription == null, "Cannot subscribe more than once!");

		// old: wait till call-stack completes, so we don't violate "can't change observables from within computation" rule
		// we can't change observables from within computed values/funcs/store-accessors, so do it in a moment (out of computation call-stack)
		/*WaitXThenRun(0, ()=> {
			runInAction("TreeNode.Subscribe_prep", ()=>this.status = DataStatus.Waiting);
		});*/
		//Assert(MobX_GetGlobalState().computationDepth == 0, "Cannot call TreeNode.Subscribe from within a computation.");
		Assert(MobX_AllowStateChanges(), "TreeNode.Subscribe must be called from within a mobx action. (and not be run within a mobx computation)");
		RunInAction("TreeNode.Subscribe_prep", ()=>this.self_subscriptionStatus = SubscriptionStatus.Waiting);

		MaybeLog_Base(a=>a.subscriptions, l=>l(`Subscribing to: ${this.path}`));
		if (this.type == TreeNodeType.Document) {
			this.self_apolloObservable = this.graph.subs.apollo.subscribe({
				query: this.query.GraphQLQuery,
				variables: this.query.vars,
			});
			this.self_subscription = this.self_apolloObservable.subscribe({
				next: data=>{
					const returnedData = data.data; // if requested from top-level-query "map", data.data will have shape: {map: {...}}
					//const returnedDocument = returnedData[Object.keys(this.query.vars!)[0]]; // so unwrap it here
					Assert(Object.values(returnedData).length == 1);
					const returnedDocument = Object.values(returnedData)[0] as any; // so unwrap it here
					MaybeLog_Base(a=>a.subscriptions, l=>l(`Got doc snapshot. @path(${this.path}) @snapshot:`, returnedDocument));
					RunInAction_WhenAble("TreeNode.Subscribe.onSnapshot_doc", ()=> {
						this.data_fromSelf.SetData(returnedDocument, false);
						this.self_subscriptionStatus = SubscriptionStatus.ReadyAndLive;
					});
				},
				error: err=>console.error("SubscriptionError:", err), // Does an error here mean the subscription is no longer valid? If so, we should probably unsubscribe->resubscribe.
				//complete: ()=>console.error("SubscriptionComplete."), // handling presumably useful, but oddly, neither "error" nor "complete" doesn't seem to trigger when server goes down
			});
		} else {
			this.self_apolloObservable = this.graph.subs.apollo.subscribe({
				query: this.query.GraphQLQuery,
				variables: this.query.vars,
			});
			this.self_subscription = this.self_apolloObservable.subscribe({
				next: data=>{
					const docs = data.data[CE(this.pathSegments_noQuery).Last()].nodes;
					Assert(docs != null && docs instanceof Array);
					const fromCache = false;

					MaybeLog_Base(a=>a.subscriptions, l=>l(`Got collection snapshot. @path(${this.path}) @docs:`, docs));
					RunInAction_WhenAble("TreeNode.Subscribe.onSnapshot_collection", ()=> {
						const deletedDocIDs = CE(Array.from(this.docNodes.keys())).Exclude(...docs.map(a=>a.id));
						let dataChanged = false;
						for (const doc of docs) {
							if (!this.docNodes.has(doc.id)) {
								this.docNodes.set(doc.id, new TreeNode(this.graph, this.pathSegments.concat([doc.id])));
							}
							//dataChanged = this.docNodes.get(doc.id)!.SetData(doc.data(), fromCache) || dataChanged;
							dataChanged = this.docNodes.get(doc.id)!.data_fromParent.SetData(doc, fromCache) || dataChanged;
						}
						for (const docID of deletedDocIDs) {
							const docNode = this.docNodes.get(docID);
							dataChanged = docNode?.data_fromParent.SetData(null, fromCache) || dataChanged;
							//docNode?.Unsubscribe(); // if someone subscribed directly, I guess we let them keep the detached subscription?
							this.docNodes.delete(docID);
						}
	
						this.data_fromSelf.UpdateStatusAfterDataChange(dataChanged, fromCache);
						this.self_subscriptionStatus = SubscriptionStatus.ReadyAndLive;
					});
				},
				error: err=>console.error("SubscriptionError:", err), // Does an error here mean the subscription is no longer valid? If so, we should probably unsubscribe->resubscribe.
				//complete: ()=>console.error("SubscriptionComplete."), // handling presumably useful, but oddly, neither "error" nor "complete" doesn't seem to trigger when server goes down
			});
		}
	}
	Unsubscribe(allowKeepDataCached = true) {
		if (this.self_apolloObservable == null || this.self_subscription == null) return null;
		let {self_apolloObservable: observable, self_subscription: subscription} = this;
		this.self_apolloObservable = null;
		MaybeLog_Base(a=>a.subscriptions, l=>l(`Unsubscribing from: ${this.path}`));
		this.self_subscription.unsubscribe();
		this.self_subscription = null;
		RunInAction("TreeNode.Unsubscribe", ()=>this.self_subscriptionStatus = SubscriptionStatus.Initial);
		this.data_fromSelf.NotifySubscriptionDropped(allowKeepDataCached);
		return {observable, subscription};
	}
	UnsubscribeAll(allowKeepDataCached = true, nodesThatHadActiveSubscription: Set<TreeNode<any>> = new Set()) {
		if (this.self_subscription != null) {
			nodesThatHadActiveSubscription.add(this);
		}
		this.Unsubscribe(allowKeepDataCached);
		this.collectionNodes.forEach(a=>a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveSubscription));
		this.queryNodes.forEach(a=>a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveSubscription));
		this.docNodes.forEach(a=>a.UnsubscribeAll(allowKeepDataCached, nodesThatHadActiveSubscription));
		return nodesThatHadActiveSubscription;
	}
	
	// data
	// ==========

	// these fields are only related to data_fromSelf (not data_fromParent)
	self_subscriptionStatus = SubscriptionStatus.Initial; // [@O]
	self_apolloObservable: Observable<FetchResult<any, Record<string, any>, Record<string, any>>>|null;
	self_subscription: ObservableSubscription|null;

	data_fromParent = new TreeNodeData<DataShape>();
	data_fromSelf = new TreeNodeData<DataShape>();
	get PreferredDataContainer() { // [@computed]
		if (this.type == TreeNodeType.Document) {
			const prefLevel_fromParent = GetPreferenceLevelOfDataStatus(this.data_fromParent.status);
			const prefLevel_fromSelf = GetPreferenceLevelOfDataStatus(this.data_fromSelf.status);
			if (prefLevel_fromParent > prefLevel_fromSelf) {
				return this.data_fromParent;
			}
			return this.data_fromSelf;
		}
		return this.data_fromSelf;
	}
	/*get PreferredDataStatus() { // [@computed]
		const preferredContainer = this.PreferredDataContainer;
		return GetPreferenceLevelOfDataStatus(preferredContainer.status);
	}*/
	get PreferredData() { // [@computed]
		return this.PreferredDataContainer.data;
	}
	/*SetData(data: DataShape, fromCache: boolean, containerField: "data_fromParent" | "data_fromSelf") {
		let container = containerField == "data_fromParent" ? this.data_fromParent : this.data_fromSelf;
		return container.SetData(data, fromCache);
	}*/

	get DocDatas() { // [@computed]
		//let docNodes = Array.from(this.docNodes.values()).filter(a=>a.status_forDirectSubscription == DataStatus.Received_Full && a.data != null);
		//let docNodes = Array.from(this.docNodes.values()).filter(a=>a.IsDataAcceptableToConsume(true));
		// for collections, we need to filter out nodes that were found (or at least requested) at some point, but whose data is now null (collections should never have null items)
		let docNodes = Array.from(this.docNodes.values()).filter(a=>a.data_fromParent.data != null);
		let docDatas = docNodes.map(docNode=>docNode.data_fromParent.data);
		//let docDatas = observable.array(docNodes.map(docNode=>docNode.data));
		return docDatas;
	}

	// hierarchy
	// ==========

	// for doc (and root) nodes
	collectionNodes = observable.map<string, TreeNode<any>>(); // [@O]
	//collectionNodes = new Map<string, TreeNode<any>>();
	
	// for collection (and collection-query) nodes
	queryNodes = observable.map<string, TreeNode<any>>(); // [@O] for collection nodes
	//queryNodes = new Map<string, TreeNode<any>>(); // for collection nodes
	query: QueryParams_Linked; // for collection-query nodes
	docNodes = observable.map<string, TreeNode<any>>(); // [@O]
	//docNodes = new Map<string, TreeNode<any>>();

	get AllChildNodes(): TreeNode<any>[] {
		return [
			...this.collectionNodes.values(),
			...this.queryNodes.values(),
			...this.docNodes.values(),
		];
	}
	get AllDescendantNodes(): TreeNode<any>[] {
		return CE(this.AllChildNodes).SelectMany(a=>a.AllDescendantNodes);
	}

	// default createTreeNodesIfMissing to false, so that it's safe to call this from a computation (which includes store-accessors)
	Get(subpathOrGetterFunc: string | string[] | ((data: DataShape)=>any), query?: QueryParams, createTreeNodesIfMissing = false): TreeNode<any>|null {
		let subpathSegments = PathOrPathGetterToPathSegments(subpathOrGetterFunc);

		let proceed_inAction = ()=>RunInAction(`TreeNode.Get @path(${this.path})`, ()=>proceed(true)); // cannot use DoX_ComputationSafe, since we need the return value
		//let proceed_inAction = ()=>DoX_ComputationSafe(`TreeNode.Get @path(${this.path})`, ()=>proceed(true));
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
	result["data"] = treeNode.PreferredData;

	for (let [key, collection] of treeNode.collectionNodes) {
		result[key] = TreeNodeToRawData(collection);
	}
	for (let [key, collection] of treeNode.queryNodes) {
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