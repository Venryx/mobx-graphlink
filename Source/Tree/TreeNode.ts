import {DocumentNode, FetchResult, gql} from "@apollo/client/core/index.js";
import {Observable} from "@apollo/client/utilities/index.js";
import {Assert, CE, E, FromJSON, ModifyString, ObjectCE, ToJSON, ToJSON_Advanced} from "js-vextensions";
import {observable, ObservableMap, runInAction, _getGlobalState} from "mobx";
import {collection_docSchemaName, GetSchemaJSON} from "../Extensions/SchemaHelpers.js";
import {Graphlink} from "../Graphlink.js";
import {JSONStringify_NoQuotesForKeys, MaybeLog_Base} from "../Utils/General.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "../Utils/PathHelpers.js";

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

export class QueryParams {
	static ParseString(dataStr: string) {
		return QueryParams.ParseData(FromJSON(dataStr));
	}
	static ParseData(data: any) {
		return new QueryParams(data);
	}
	toString() {
		//return ToJSON(CE(this).Including("variablesStr", "variables"));
		return ToJSON(this);
	}

	constructor(initialData?: Partial<QueryParams_Linked>) {
		CE(this).Extend(initialData);
	}

	/** Example: "$limit: Int!, $maxValue: Int!" */
	varsDefine?: string;
	/** Example: {limit: 10, maxValue: 100} */
	vars?: Object;

	// arguments (definition: https://stackoverflow.com/a/55474252)
	// ==========

	// old way 1; dropped for now, since there are two many filters-and-such possible with the connection-filter plugin
	//queryOps = [] as QueryOp[];

	// old way 2; dropped, since safer to use JSON stringification
	/*#* Example: "first: $limit, filter: {someProp: {lessThan: $maxValue}}" */
	//argsStr?: string;

	// enables stuff like "id: $id" (direct selection-by-id, rather than using filter system)
	args_rawPrefixStr?: string;
	// for other random things possible on server-side 
	args_custom?: Object;

	// filtering
	/** Example: {someProp: {lessThan: $maxValue}}*/
	filter?: Object;

	// pagination
	first?: number;
	after?: string;
	last?: number;
	before?: string;
}

/** Class specifies the filtering, sorting, etc. for a given TreeNode. */
// (comments based on usage with Postgraphile and https://github.com/graphile-contrib/postgraphile-plugin-connection-filter)
export class QueryParams_Linked extends QueryParams {
	toString() {
		return ToJSON(this);
	}

	constructor(initialData?: {treeNode: TreeNode<any>} & Partial<QueryParams_Linked>) {
		super();
		CE(this).Extend(initialData);
		this.CalculateDerivatives();
	}
	
	treeNode: TreeNode<any>;
	get CollectionName(): string {
		return this.treeNode.pathSegments[0];
	}
	get DocSchemaName() {
		//if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
		const docSchemaName = collection_docSchemaName.get(this.CollectionName);
		Assert(docSchemaName, `No schema has been associated with collection "${this.CollectionName}". Did you forget the \`@Table("DOC_SCHEMA_NAME")\` decorator?`);
		return docSchemaName!;
	}

	// derivatives
	private queryStr: string;
	get QueryStr() { return this.queryStr; }
	private graphQLQuery: DocumentNode;
	get GraphQLQuery() { return this.graphQLQuery; }
	CalculateDerivatives() {
		if (this.treeNode.type != TreeNodeType.Root) {
			this.queryStr = this.ToQueryStr();
			this.graphQLQuery = gql(this.queryStr);
		}
	}

	ToQueryStr() {
		Assert(this.treeNode.type != TreeNodeType.Root, "Cannot create QueryParams for the root TreeNode.");
		const docSchema = GetSchemaJSON(this.DocSchemaName);
		Assert(docSchema, `Cannot find schema with name "${this.DocSchemaName}".`);

		let varsDefineAsStr = "";
		if (this.varsDefine) {
			varsDefineAsStr = `(${this.varsDefine})`;
		}

		let argsAsStr = "";

		const nonNullAutoArgs = ["first", "after", "last", "before", "filter"].filter(key=>{
			if (this[key] == null) return false;
			const IsEmptyObj = obj=>typeof obj == "object" && (Object.keys(obj).length == 0 || Object.values(obj).filter(a=>a != null).length == 0);
			if (IsEmptyObj(this[key])) return false; // don't add if just empty object (server complains)
			if (IsEmptyObj(Object.values(this[key]).filter(a=>a)[0])) return false; // don't add if just object containing empty object(s) (server complains)
			/*if (IsEmptyObj(this[key])) {
				throw new Error(`Query arg "${key}" is invalid; the value is empty (ie. null, a key-less object, or an object whose keys all have null assigned). @arg:${ToJSON_Advanced(this[key], {stringifyUndefinedAs: null})}`);
			}
			const firstNonNullSubObj = Object.values(this[key]).filter(a=>a)[0];
			if (IsEmptyObj(firstNonNullSubObj)) {
				throw new Error(`Query arg "${key}" is invalid; the value has no subobject that is non-empty. @arg:${ToJSON_Advanced(this[key], {stringifyUndefinedAs: null})}`);
			}*/
			return true;
		});

		if (this.args_rawPrefixStr || Object.keys(this.args_custom ?? {}).length || nonNullAutoArgs.length) {
			const argsObj = {} as any;

			// add custom args
			for (const [key, value] of Object.keys(this.args_custom ?? {})) {
				argsObj[key] = value;
			}
			
			// add auto args
			for (const key of nonNullAutoArgs) {
				argsObj[key] = this[key];
			}
			if (argsObj.filter) {
				for (const [key, value] of Object.entries(argsObj.filter as any)) {
					// if filter entry's value is falsy, remove (so user can use pattern type: `{prop: shouldRequire3 && {equalTo: 3}}`)
					if (!value) {
						delete argsObj[key];
					}
				}
			}

			//const argsAsStr_json = Object.keys(argsObj).length ? JSON.stringify(argsObj) : "";
			const argsAsStr_json = Object.keys(argsObj).length ? JSONStringify_NoQuotesForKeys(argsObj) : "";
			const argsStr_parts = [
				this.args_rawPrefixStr,
				argsAsStr_json.slice(1, -1), // remove "{}"
			].filter(a=>a);
			argsAsStr = `(${argsStr_parts.join(", ")})`; // wrap with "()"
		}
		
		if (this.treeNode.type == TreeNodeType.Document) {
			const pairs = CE(docSchema.properties).Pairs();
			Assert(pairs.length > 0, `Cannot create GraphQL type for "${this.DocSchemaName}" without at least 1 property.`);
			return `
				subscription DocInCollection_${this.CollectionName}${varsDefineAsStr} {
					${
						//ModifyString(this.DocSchemaName, m=>[m.startUpper_to_lower, m.underscoreUpper_to_underscoreLower])
						this.CollectionName.replace(/ies$/, "y").replace(/s$/, "")
					}${argsAsStr} {
						${pairs.map(a=>a.key).join(" ")}
					}
				}
			`;
		} else {
			const pairs = CE(docSchema.properties).Pairs();
			Assert(pairs.length > 0, `Cannot create GraphQL type for "${this.CollectionName}" without at least 1 property.`);

			return `
				subscription Collection_${this.CollectionName}${varsDefineAsStr} {
					${this.CollectionName}${argsAsStr} {
						nodes { ${pairs.map(a=>a.key).join(" ")} }
					}
				}
			`;
		}
	}
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
						const deletedDocIDs = CE(Array.from(this.docNodes.keys())).Except(...docs.map(a=>a.id));
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
			//ProcessDBData(data, true, CE(this.pathSegments).Last());
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
		let currentNode: TreeNode<any> = this;

		let proceed_inAction = ()=>runInAction(`TreeNode.Get @path(${this.path})`, ()=>proceed(true));
		let proceed = (inAction: boolean)=> {
			currentNode = this;
			for (let [index, segment] of subpathSegments.entries()) {
				let subpathSegmentsToHere = subpathSegments.slice(0, index + 1);
				let childNodesMap = currentNode[currentNode.type == TreeNodeType.Collection ? "docNodes" : "collectionNodes"] as ObservableMap<string, TreeNode<any>>;
				if (!childNodesMap.has(segment) && createTreeNodesIfMissing) {
					if (!inAction) return proceed_inAction(); // if not yet running in action, restart in one
					//let pathToSegment = subpathSegments.slice(0, index).join("/");
					childNodesMap.set(segment, new TreeNode(this.graph, this.pathSegments.concat(subpathSegmentsToHere)));
				}
				currentNode = childNodesMap.get(segment)!;
				if (currentNode == null) break;
			}
			if (query && currentNode) {
				// make sure query object is an "actual instance of" QueryParams (else query.toString() will return useless "[object Object]")
				Object.setPrototypeOf(query, QueryParams.prototype);
				if (!currentNode.queryNodes.has(query.toString()) && createTreeNodesIfMissing) {
					if (!inAction) return proceed_inAction(); // if not yet running in action, restart in one
					currentNode.queryNodes.set(query.toString(), new TreeNode(this.graph, this.pathSegments.concat(subpathSegments).concat("@query:" + query)))
				}
				currentNode = currentNode.queryNodes.get(query.toString())!;
			}
		}
		// first, try proceeding without runInAction 
		proceed(false);

		return currentNode;
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