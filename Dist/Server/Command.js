var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ArrayCE, Assert, Clone, E } from "js-vextensions";
import { GetAsync } from "../Accessors/Helpers.js";
import { AssertValidate } from "../Extensions/JSONSchemaHelpers.js";
import { GenerateUUID } from "../Extensions/KeyGenerator.js";
import { defaultGraphOptions } from "../Graphlink.js";
import { CleanDBData } from "../index.js";
import { WithBrackets } from "../Tree/QueryParams.js";
import { gql } from "../Utils/@NPMFixes/apollo_client.js";
import { DBUpdate, DBUpdateType } from "../Utils/DB/DBUpdate.js";
import { ApplyDBUpdates, ApplyDBUpdates_Local } from "../Utils/DB/DBUpdateApplier.js";
import { MaybeLog_Base } from "../Utils/General/General.js";
import { GetCommandClassMetadata } from "./CommandMetadata.js";
export const commandsWaitingToComplete_new = [];
let currentCommandRun_listeners = [];
function WaitTillCurrentCommandFinishes() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            currentCommandRun_listeners.push({ resolve, reject });
        });
    });
}
function NotifyListenersThatCurrentCommandFinished() {
    const currentCommandRun_listeners_copy = currentCommandRun_listeners;
    currentCommandRun_listeners = [];
    for (const listener of currentCommandRun_listeners_copy) {
        listener.resolve();
    }
}
// require command return-value to always be an object; this provides more schema stability (eg. lets you change the return-data of a mutation, without breaking the contents of "legacy" keys)
export class Command {
    constructor(...args) {
        //userInfo: FireUserInfo;
        Object.defineProperty(this, "_userInfo_override", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // for use on server (so permissions are checked against the calling user's id rather than the server's )
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "payload", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        //prepareStartTime: number;
        //runStartTime: number;
        //returnData = {} as any;
        Object.defineProperty(this, "returnData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        // these methods are executed on the server (well, will be later)
        // ==========
        // parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload
        Object.defineProperty(this, "parentCommand", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Last validation error, from calling Validate_Safe(). */
        Object.defineProperty(this, "validateError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // helper-methods to be called within user-supplied Validate() function
        /*generatedUUIDs = new DeepMap<string>();
        GenerateUUID_Once(obj: any, propName: string) {
            const entry = this.generatedUUIDs.entry([obj, propName]);
            if (!entry.exists()) {
                entry.set(GenerateUUID());
            }
            return entry.get();
        }*/
        Object.defineProperty(this, "generatedUUIDs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        let options, payload;
        if (args.length == 1)
            [payload] = args;
        else
            [options, payload] = args;
        const opt = E(defaultGraphOptions, options);
        this.type = this.constructor.name;
        this.options = opt;
        //this.payload = E(this.constructor["defaultPayload"], payload);
        // use Clone on the payload, so that behavior is consistent whether called locally or over the network
        const meta = GetCommandClassMetadata(this.constructor.name);
        this.payload = E(Clone(meta.defaultPayload), Clone(payload));
    }
    //_userInfo_override_set = false;
    get userInfo() {
        if (this.options.graph.onServer) {
            Assert(this._userInfo_override != null, `For commands being run on the server, user-info must be explicitly attached. @Command:${this.constructor.name}`);
            return this._userInfo_override;
        }
        else {
            return this.options.graph.userInfo;
        }
    }
    MarkAsSubcommand(parentCommand) {
        this.parentCommand = parentCommand;
        this._userInfo_override = parentCommand._userInfo_override;
        //this.Validate_Early();
        return this;
    }
    /** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
    Validate_Full() {
        const meta = GetCommandClassMetadata(this.constructor.name);
        AssertValidate(meta.payloadSchema, this.payload, "Payload is invalid.", { addSchemaObject: true });
        this.Validate();
        AssertValidate(meta.returnSchema, this.returnData, "Return-data is invalid.", { addSchemaObject: true });
    }
    get ValidateErrorStr() {
        var _a, _b;
        return (_b = (_a = this.validateError) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null;
    }
    Validate_Safe() {
        try {
            this.Validate_Full();
            this.validateError = null;
            return null;
        }
        catch (ex) {
            this.validateError = ex;
            return ex;
        }
    }
    Validate_Async(options) {
        return __awaiter(this, void 0, void 0, function* () {
            //await GetAsync(()=>this.Validate(), E({errorHandling: "ignore"}, IsNumber(maxIterations) && {maxIterations}));
            //await GetAsync(()=>this.Validate(), {errorHandling: "ignore", maxIterations: OmitIfFalsy(maxIterations)});
            yield GetAsync(() => this.Validate_Full(), E({ throwImmediatelyOnDBWait: true }, options));
        });
    }
    /** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
    GetDBUpdates() {
        const helper = new DBHelper();
        this.DeclareDBUpdates(helper);
        const dbUpdates = helper._dbUpdates;
        return dbUpdates;
    }
    PreRun() {
        return __awaiter(this, void 0, void 0, function* () {
            //RemoveHelpers(this.payload);
            yield this.Validate_Async();
        });
    }
    /** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. */
    RunLocally() {
        return __awaiter(this, void 0, void 0, function* () {
            if (commandsWaitingToComplete_new.length > 0) {
                MaybeLog_Base(a => a.commands, l => l(`Queing command, since ${commandsWaitingToComplete_new.length} ${commandsWaitingToComplete_new.length == 1 ? "is" : "are"} already waiting for completion.${""}@type:`, this.constructor.name, " @payload(", this.payload, ")"));
            }
            commandsWaitingToComplete_new.push(this);
            while (commandsWaitingToComplete_new[0] != this) {
                yield WaitTillCurrentCommandFinishes();
            }
            currentCommandRun_listeners = [];
            MaybeLog_Base(a => a.commands, l => l("Running command. @type:", this.constructor.name, " @payload(", this.payload, ")"));
            try {
                //this.runStartTime = Date.now();
                yield this.PreRun();
                const dbUpdates = this.GetDBUpdates();
                if (this.options.graph.ValidateDBData) {
                    yield this.Validate_LateHeavy(dbUpdates);
                }
                // FixDBUpdates(dbUpdates);
                // await store.firebase.helpers.DBRef().update(dbUpdates);
                yield ApplyDBUpdates(dbUpdates);
                // todo: make sure the db-changes we just made are reflected in our mobx store, *before* current command is marked as "completed" (else next command may start operating on not-yet-refreshed data)
                // MaybeLog(a=>a.commands, ()=>`Finishing command. @type:${this.constructor.name} @payload(${ToJSON(this.payload)}) @dbUpdates(${ToJSON(dbUpdates)})`);
                MaybeLog_Base(a => a.commands, l => l("Finishing command. @type:", this.constructor.name, " @command(", this, ") @dbUpdates(", dbUpdates, ")"));
            } /*catch (ex) {
                console.error(`Hit error while executing command of type "${this.constructor.name}". @error:`, ex, "@payload:", this.payload);
            }*/
            finally {
                //const areOtherCommandsBuffered = currentCommandRun_listeners.length > 0;
                ArrayCE(commandsWaitingToComplete_new).Remove(this);
                NotifyListenersThatCurrentCommandFinished();
            }
            // later on (once set up on server), this will send the data back to the client, rather than return it
            return this.returnData;
        });
    }
    /** Same as Run(), except with the server executing the command rather than the current context. */
    RunOnServer() {
        return __awaiter(this, void 0, void 0, function* () {
            const meta = GetCommandClassMetadata(this.constructor.name);
            const returnDataSchema = meta.returnSchema;
            //const returnData_propPairs = ObjectCE(returnDataSchema.properties).Pairs();
            const fetchResult = yield this.options.graph.subs.apollo.mutate({
                mutation: gql `
				mutation ${this.constructor.name}${WithBrackets(meta.Args_GetVarDefsStr())} {
					${this.constructor.name}${WithBrackets(meta.Args_GetArgsUsageStr())} {
						${meta.Return_GetFieldsStr()}
					}
				}
			`,
                variables: this.payload,
            });
            const result = CleanDBData(fetchResult.data[this.constructor.name]);
            AssertValidate(returnDataSchema, result, `Return-data for command did not match the expected shape. ReturnData: ${JSON.stringify(result, null, 2)}`);
            return result;
        });
    }
    // standard validation of common paths/object-types; perhaps disable in production
    Validate_LateHeavy(dbUpdates) {
        return __awaiter(this, void 0, void 0, function* () {
            // validate "nodes/X"
            /*let nodesBeingUpdated = (dbUpdates.VKeys() as string[]).map(a=> {
                let match = a.match(/^nodes\/([0-9]+).*#/);
                return match ? match[1].ToInt() : null;
            }).filter(a=>a).Distinct();
            for (let nodeID of nodesBeingUpdated) {
                let oldNodeData = await GetAsync_Raw(()=>GetNode(nodeID));
                let updatesForNode = dbUpdates.Props().filter(a=>a.name.match(`^nodes/${nodeID}($|/)`));
    
                let newNodeData = oldNodeData;
                for (let update of updatesForNode) {
                    newNodeData = u.updateIn(update.name.replace(new RegExp(`^nodes/${nodeID}($|/)`), "").replace(/\//g, "."), u.constant(update.value), newNodeData);
                }
                if (newNodeData != null) { // (if null, means we're deleting it, which is fine)
                    AssertValidate("MapNode", newNodeData, `New node-data is invalid.`);
                }
            }*/
            // locally-apply db-updates, then validate the result (for now, only works for already-loaded data paths)
            const oldData = Clone(this.options.graph.tree.AsRawData());
            const newData = ApplyDBUpdates_Local(oldData, dbUpdates);
            this.options.graph.ValidateDBData(newData);
        });
    }
    GenerateUUID_Once(path) {
        if (!this.generatedUUIDs.has(path)) {
            this.generatedUUIDs.set(path, GenerateUUID());
        }
        return this.generatedUUIDs.get(path);
    }
}
export class DBHelper {
    constructor() {
        Object.defineProperty(this, "_dbUpdates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        /*delete(path: string, value: any) {
            this._dbUpdates.push(new DBUpdate({type: DBUpdateType.delete, path, value}));
        }*/
    }
    // add multiple pre-made db-updates (eg. from subcommand)
    add(dbUpdates) {
        this._dbUpdates.push(...dbUpdates);
    }
    // helpers for adding one db-update
    set(path, value) {
        this._dbUpdates.push(new DBUpdate({ type: DBUpdateType.set, path, value }));
    }
}
