var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { TreeNode } from "./Tree/TreeNode.js";
import { makeObservable, observable } from "mobx";
export let defaultGraphOptions;
export function SetDefaultGraphOptions(opt) {
    defaultGraphOptions = opt;
}
export class GraphlinkInitOptions {
    constructor() {
        Object.defineProperty(this, "rootStore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apollo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onServer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        //initSubs = true;
        // server-specific
        Object.defineProperty(this, "knexModule", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pgPool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
}
export class Graphlink {
    constructor(initOptions) {
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "rootStore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "storeOverridesStack", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "storeAccessorCachingTempDisabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        //accessorContext: AccessorContext<RootStoreShape> = new AccessorContext<RootStoreShape>(this);
        Object.defineProperty(this, "lastRunAccessor_meta", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /*InitSubs() {
            // todo
            this.subs.apollo = null;
        }*/
        Object.defineProperty(this, "onServer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "subs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "userInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
        Object.defineProperty(this, "tree", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "treeRequestWatchers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "ValidateDBData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        makeObservable(this);
        if (initOptions) {
            this.Initialize(initOptions);
        }
    }
    Initialize(initOptions) {
        let { rootStore, apollo, onServer, knexModule, pgPool } = initOptions;
        Graphlink.instances.push(this);
        this.rootStore = rootStore;
        //if (initSubs) {
        //this.InitSubs();
        this.onServer = onServer;
        this.subs.apollo = apollo;
        this.subs.knexModule = knexModule;
        this.subs.pgPool = pgPool;
        this.tree = new TreeNode(this, []);
        this.initialized = true;
    }
    SetUserInfo(userInfo, clearCaches = true) {
        this.userInfo = userInfo;
        if (clearCaches) {
            console.log("Clearing mobx-graphlink and apollo cache, due to user-info change.");
            return (async () => {
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
    //pathSubscriptions: Map<string, PathSubscription>;
    UnsubscribeAll() {
        this.tree.UnsubscribeAll();
    }
}
Object.defineProperty(Graphlink, "instances", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: []
});
__decorate([
    observable
], Graphlink.prototype, "userInfo", void 0);
export class UserInfo {
    constructor() {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        //displayName: string;
    }
}
