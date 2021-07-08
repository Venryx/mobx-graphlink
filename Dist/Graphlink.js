var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { TreeNode } from "./Tree/TreeNode.js";
import { observable } from "mobx";
import { AccessorContext } from "./Accessors/CreateAccessor.js";
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
        this.accessorContext = new AccessorContext(this);
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
    LogIn() {
        return __awaiter(this, void 0, void 0, function* () {
            // todo
            return null;
        });
    }
    LogIn_WithCredential() {
        return __awaiter(this, void 0, void 0, function* () {
            // todo
            return null;
        });
    }
    LogOut() {
        return __awaiter(this, void 0, void 0, function* () {
            // todo
        });
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
