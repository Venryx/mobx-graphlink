import { nodesByPath, SubscriptionStatus, TreeNode } from "./Tree/TreeNode.js";
import { observable } from "mobx";
import { makeObservable_safe, RunInAction } from "./Utils/General/MobX.js";
import { Assert } from "js-vextensions";
import { DataCommitScheduler } from "./Components/DataCommitScheduler.js";
export class GraphlinkInitOptions {
}
export class GraphlinkOptions {
    constructor(data) {
        this.unsubscribeTreeNodesAfter = 5000;
        /** After each data-update, how long to wait for another data-update; if another occurs during this period, the timer is reset, and another wait occurs. (until max-wait is reached) */
        this.dataUpdateBuffering_minWait = 10;
        this.dataUpdateBuffering_maxWait = 100;
        this.dataUpdateBuffering_breakApartCommitSetsLongerThan = 1000;
        Object.assign(this, data);
    }
}
export class Graphlink {
    constructor(initOptions, options) {
        this.initialized = false;
        this.storeOverridesStack = [];
        /** Set this to false if you need to make sure all relevant database-requests within an accessor tree are being activated. */
        this.storeAccessorCachingTempDisabled = false;
        //accessorContext: AccessorContext<RootStoreShape> = new AccessorContext<RootStoreShape>(this);
        // call-stack stuff
        //lastRunAccessor_meta: AccessorMetadata|undefined;
        //currentDeepestCallPlanActive: AccessorCallPlan;
        // only use this for determining the "current deepest call-plan"; cannot construct a true/traditional "call-stack" since mobx-based "call-stacks" can trigger either top-down or bottom-up
        this.callPlan_callStack = [];
        this.subs = {};
        this.userInfo = null; // [@O]
        this.treeRequestWatchers = new Set();
        this.allTreeNodes = new Set();
        makeObservable_safe(this, {
            userInfo: observable,
        });
        if (initOptions) {
            this.Initialize(initOptions, options);
        }
        else {
            Assert(options == null);
        }
    }
    Initialize(initOptions, options) {
        let { rootStore, apollo, onServer, knexModule, pgPool } = initOptions;
        Graphlink.instances.push(this);
        this.rootStore = rootStore;
        //if (initSubs) {
        //this.InitSubs();
        this.onServer = onServer;
        this.subs.apollo = apollo;
        this.subs.knexModule = knexModule;
        this.subs.pgPool = pgPool;
        this.options = options !== null && options !== void 0 ? options : new GraphlinkOptions();
        this.commitScheduler = new DataCommitScheduler(this);
        this.tree = new TreeNode(this, []);
        this.initialized = true;
    }
    GetDeepestCallPlanCurrentlyRunning() {
        return this.callPlan_callStack[this.callPlan_callStack.length - 1];
    }
    /** Can be called prior to Graphlink.Initialize(). */
    async SetUserInfo(userInfo, clearCaches = true, resubscribeAfter = true) {
        this.userInfo = userInfo;
        if (clearCaches && this.initialized) {
            console.log("Clearing mobx-graphlink and apollo cache, due to user-info change.");
            let nodesThatHadActiveSubscription = await this.ClearCaches();
            if (resubscribeAfter) {
                RunInAction("SetUserInfo.resubscribeAfter", () => {
                    for (const node of nodesThatHadActiveSubscription) {
                        if (node.self_subscription == null) { // check, in case node was already resubscribed by an external caller
                            node.Subscribe();
                        }
                    }
                });
            }
            return nodesThatHadActiveSubscription;
        }
    }
    async ClearCaches() {
        /*for (const node of this.tree.AllDescendantNodes) {
            node.data
        }*/
        // first, unsubscribe everything; this lets the server release the old live-queries
        let nodesThatHadActiveSubscription = this.tree.UnsubscribeAll(false);
        nodesByPath.clear(); // also clear this (debugging collection to track if multiple nodes are created for same path); tree is resetting, so reset this list too
        // then, delete/detach all the collection tree-nodes; this is equivalent to clearing the mobx-graphlink cache (well, cache should be cleared by `UnsubscribeAll(false)` above, but this makes certain)
        // commented; this causes issues in mobx-graphlink, where the old subtrees are still being observed (by the accessors), yet are disconnected from the new set created by new requests
        // todo: add asserts to avoid mistakes like this in the future (eg. by confirming that whenever processing is done for a TreeNode, it is still connected to the graphlink root)
        /*for (const [key, collectionNode] of this.tree.collectionNodes) {
            this.tree.collectionNodes.delete(key);
        }*/
        // clear the apollo-cache as well (since mobx-graphlink uses subscriptions exclusively, this probably isn't necessary, but we'll clear it anyway to be sure)
        await this.subs.apollo.cache.reset();
        await this.subs.apollo.clearStore();
        return nodesThatHadActiveSubscription;
    }
    //pathSubscriptions: Map<string, PathSubscription>;
    UnsubscribeAll() {
        this.tree.UnsubscribeAll();
    }
    NodesWhere(filterFunc) {
        return [...this.allTreeNodes].filter(filterFunc);
    }
    // these are just stats that the consumer may be interested in
    GetStats() {
        return new GraphlinkStats({
            attachedTreeNodes: this.allTreeNodes.size,
            nodesWithRequestedSubscriptions: this.NodesWhere(a => a.self_subscriptionStatus != SubscriptionStatus.Initial).length,
            //nodesWithFulfilledSubscriptions: this.NodesWhere(a=>ObjectCE(a.PreferredDataContainer.status).IsOneOf(DataStatus.Received_Live, DataStatus.Received_CachedByMGL)).length,
            nodesWithFulfilledSubscriptions: this.NodesWhere(a => a.self_subscriptionStatus == SubscriptionStatus.ReadyAndLive).length,
        });
    }
}
Graphlink.instances = [];
export class GraphlinkStats {
    constructor(data) {
        Object.assign(this, data);
    }
}
export class UserInfo {
}
// graph-refs system (this is how the standalone functions are able to know which graph they're operating on)
// ==========
export let defaultGraphRefs;
export function SetDefaultGraphRefs(opt) {
    defaultGraphRefs = opt;
}
