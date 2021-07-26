import {TreeNode} from "./Tree/TreeNode.js";
import {TreeRequestWatcher} from "./Tree/TreeRequestWatcher.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "./Utils/DB/DBPaths.js";
import {makeObservable, observable, runInAction} from "mobx";
import type {PoolClient} from "pg";
import type Knex from "knex";
import {AccessorMetadata} from "./Accessors/@AccessorMetadata.js";
import {ApolloClient, NormalizedCacheObject} from "./Utils/@NPMFixes/apollo_client.js";

export let defaultGraphOptions: GraphOptions;
export function SetDefaultGraphOptions(opt: GraphOptions) {
	defaultGraphOptions = opt;
}
export interface GraphOptions<StoreShape = any, DBShape = any> {
	graph: Graphlink<StoreShape, DBShape>;
}

export class GraphlinkInitOptions<StoreShape> {
	rootStore: StoreShape;
	apollo: ApolloClient<NormalizedCacheObject>;
	onServer: boolean;
	//initSubs = true;

	// server-specific
	knexModule?: typeof Knex;
	pgClient?: PoolClient;
}

export class Graphlink<StoreShape, DBShape> {
	static instances = [] as Graphlink<any, any>[];

	constructor(initOptions?: GraphlinkInitOptions<StoreShape>) {
		makeObservable(this);
		if (initOptions) {
			this.Initialize(initOptions);
		}
	}

	initialized = false;
	Initialize(initOptions: GraphlinkInitOptions<StoreShape>) {
		let {rootStore, apollo, onServer, knexModule, pgClient} = initOptions;

		Graphlink.instances.push(this);
		this.rootStore = rootStore;
		//if (initSubs) {
		//this.InitSubs();
		this.onServer = onServer;
		this.subs.apollo = apollo;
		this.subs.knexModule = knexModule;
		this.subs.pgClient = pgClient;
		this.tree = new TreeNode(this, []);
		
		this.initialized = true;
	}

	rootStore: StoreShape;
	storeOverridesStack = [] as StoreShape[];
	storeAccessorCachingTempDisabled = false;
	//accessorContext: AccessorContext<RootStoreShape> = new AccessorContext<RootStoreShape>(this);
	lastRunAccessor_meta: AccessorMetadata|undefined;

	/*InitSubs() {
		// todo
		this.subs.apollo = null;
	}*/
	onServer: boolean;
	subs = {} as {
		apollo: ApolloClient<NormalizedCacheObject>;
		knexModule?: typeof Knex|null; // only used if on db-server
		pgClient?: PoolClient|null; // only used if on db-server
	};

	@observable readonly userInfo: UserInfo|null;
	SetUserInfo(userInfo: UserInfo, clearCaches = true) {
		(this as any).userInfo = userInfo;
		if (clearCaches) {
			console.log("Clearing mobx-graphlink and apollo cache, due to user-info change.");
			return (async()=>{
				/*for (const node of this.tree.AllDescendantNodes) {
					node.data
				}*/
				// delete all the collection tree-nodes; this is equivalent to clearing the mobx-graphlink cache
				for (const [key, collectionNode] of this.tree.collectionNodes) {
					this.tree.collectionNodes.delete(key);
				}

				await this.subs.apollo.cache.reset();
				await this.subs.apollo.clearStore();
			})();
		}
	}
	// todo (probably)
	/*async LogIn() {
		// todo
		return null;
	}
	async LogIn_WithCredential() {
		// todo
		return null;
	}
	async LogOut() {
		// todo
	}*/

	tree: TreeNode<DBShape>;
	treeRequestWatchers = new Set<TreeRequestWatcher>();
	//pathSubscriptions: Map<string, PathSubscription>;
	UnsubscribeAll() {
		this.tree.UnsubscribeAll();
	}

	ValidateDBData?: (dbData: DBShape)=>void;
}

export class UserInfo {
	id: string;
	//displayName: string;
}