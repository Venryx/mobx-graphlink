var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { TreeNode } from "./Tree/TreeNode.js";
import { observable } from "mobx";
export let defaultGraphOptions;
export function SetDefaultGraphOptions(opt) {
    defaultGraphOptions = opt;
}
export class GraphlinkInitOptions {
}
export class Graphlink {
    constructor(initOptions) {
        this.initialized = false;
        this.storeOverridesStack = [];
        this.storeAccessorCachingTempDisabled = false;
        /*InitSubs() {
            // todo
            this.subs.apollo = null;
        }*/
        this.subs = {};
        this.treeRequestWatchers = new Set();
        if (initOptions) {
            this.Initialize(initOptions);
        }
    }
    Initialize(initOptions) {
        let { rootStore, apollo, knexModule, pgClient } = initOptions;
        Graphlink.instances.push(this);
        this.rootStore = rootStore;
        //if (initSubs) {
        //this.InitSubs();
        this.subs.apollo = apollo;
        this.subs.knexModule = knexModule;
        this.subs.pgClient = pgClient;
        this.tree = new TreeNode(this, []);
        this.initialized = true;
    }
    //pathSubscriptions: Map<string, PathSubscription>;
    UnsubscribeAll() {
        this.tree.UnsubscribeAll();
    }
}
Graphlink.instances = [];
__decorate([
    observable
], Graphlink.prototype, "userInfo", void 0);
export class UserInfo {
}
