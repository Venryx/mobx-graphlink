import {TreeNode} from "./Tree/TreeNode.js";
import {TreeRequestWatcher} from "./Tree/TreeRequestWatcher.js";
import {PathOrPathGetterToPath, PathOrPathGetterToPathSegments} from "./Utils/DB/DBPaths.js";
import {observable, runInAction} from "mobx";
import {ApolloClient, NormalizedCacheObject} from "@apollo/client/core/index.js";
import type {PoolClient} from "pg";
import type Knex from "knex";
import {AccessorMetadata} from "./Accessors/@AccessorMetadata.js";

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

	@observable userInfo: UserInfo|null;
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