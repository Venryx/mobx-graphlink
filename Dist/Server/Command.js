import { gql } from "@apollo/client";
import { ArrayCE, Assert, CE, Clone, ConvertPathGetterFuncToPropChain, E } from "js-vextensions";
import { GetAsync } from "../Accessors/Helpers.js";
import { AssertValidate } from "../Extensions/JSONSchemaHelpers.js";
import { GenerateUUID } from "../Extensions/KeyGenerator.js";
import { defaultGraphRefs } from "../Graphlink.js";
import { CleanDBData } from "../index.js";
import { WithBrackets } from "../Tree/QueryParams.js";
import { DBUpdate, DBUpdateType } from "../Utils/DB/DBUpdate.js";
import { ApplyDBUpdates, ApplyDBUpdates_Local } from "../Utils/DB/DBUpdateApplier.js";
import { MaybeLog_Base } from "../Utils/General/General.js";
import { GetCommandClassMetadata } from "./CommandMetadata.js";
export const commandsWaitingToComplete_new = [];
let currentCommandRun_listeners = [];
async function WaitTillCurrentCommandFinishes() {
    return new Promise((resolve, reject) => {
        currentCommandRun_listeners.push({ resolve, reject });
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
        //prepareStartTime: number;
        //runStartTime: number;
        //returnData = {} as any;
        this.returnData = {};
        // helper-methods to be called within user-supplied Validate() function
        /*generatedUUIDs = new DeepMap<string>();
        GenerateUUID_Once(obj: any, propName: string) {
            const entry = this.generatedUUIDs.entry([obj, propName]);
            if (!entry.exists()) {
                entry.set(GenerateUUID());
            }
            return entry.get();
        }*/
        this.callXResults = new Map();
        let options, payload;
        if (args.length == 1)
            [payload] = args;
        else
            [options, payload] = args;
        const opt = E(defaultGraphRefs, options);
        this.type = this.constructor.name;
        this.options = opt;
        //this.payload = E(this.constructor["defaultPayload"], payload);
        // use Clone on the payload, so that behavior is consistent whether called locally or over the network
        const meta = GetCommandClassMetadata(this.constructor.name);
        this.payload_orig = Clone(payload); // needed for safe inclusion in CommandRun entries (ie. in-db command-run recording)
        this.payload = E(Clone(meta.defaultPayload), Clone(payload));
    }
    //_userInfo_override_set = false;
    get userInfo() {
        if (this.options.graph.onServer) {
            Assert(this._userInfo_override != null, `For commands being run on the server, user-info must be explicitly attached. @Command:${this.constructor.name}`);
            return this._userInfo_override;
        }
        return this.options.graph.userInfo;
    }
    /** Alias for the parent command, ie. the prior command that constructed this command. */
    get up() { return this.parentCommand; }
    Up(type) {
        return this.parentCommand ? CE(this.parentCommand).As(type) : null;
    }
    /** Parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload. [old; use IntegrateSubcommand instead] */
    MarkAsSubcommand(parentCommand) {
        this.parentCommand = parentCommand;
        this._userInfo_override = parentCommand._userInfo_override;
        //this.Validate_Early();
        return this;
    }
    /** Call this from within your command's Validate() method. */
    IntegrateSubcommand(fieldGetter, fieldSetter, 
    /** If a command is passed, the field is set every time (to the passed command); if a function is passed, the field is only set once (to the result of the function's first invokation). */
    subcommandOrCreator, preValidate) {
        var _a;
        let subcommand;
        if (typeof subcommandOrCreator == "function") {
            subcommand = (_a = fieldGetter()) !== null && _a !== void 0 ? _a : subcommandOrCreator();
        }
        else {
            subcommand = subcommandOrCreator;
        }
        subcommand.MarkAsSubcommand(this);
        //const fieldName = CE(PathOrPathGetterToPathSegments(fieldGetter)).Last();
        if (fieldSetter) {
            fieldSetter(subcommand);
        }
        else {
            const fieldName = ConvertPathGetterFuncToPropChain(fieldGetter)[0];
            this[fieldName] = subcommand;
        }
        if (preValidate) {
            preValidate(subcommand);
        }
        //subcommand.Validate();
        subcommand.Validate_Full();
    }
    get ValidateErrorStr() {
        var _a;
        const err = this.validateError;
        return (_a = err === null || err === void 0 ? void 0 : err["message"]) !== null && _a !== void 0 ? _a : err === null || err === void 0 ? void 0 : err.toString();
    }
    /** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
    Validate_Full() {
        const meta = GetCommandClassMetadata(this.constructor.name);
        AssertValidate(meta.payloadSchema, this.payload, "Payload is invalid.", { addSchemaObject: true });
        this.Validate();
        if (Command.augmentValidate) {
            Command.augmentValidate(this);
        }
        AssertValidate(meta.returnSchema, this.returnData, "Return-data is invalid.", { addSchemaObject: true });
    }
    Validate_Safe() {
        var _a;
        try {
            this.Validate_Full();
            this.validateError = undefined;
        }
        catch (ex) {
            this.validateError = ex;
            //return ex;
            return (_a = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _a !== void 0 ? _a : ex === null || ex === void 0 ? void 0 : ex.toString();
        }
    }
    async Validate_Async(options) {
        //await GetAsync(()=>this.Validate(), E({errorHandling: "ignore"}, IsNumber(maxIterations) && {maxIterations}));
        //await GetAsync(()=>this.Validate(), {errorHandling: "ignore", maxIterations: OmitIfFalsy(maxIterations)});
        await GetAsync(() => this.Validate_Full(), E({ throwImmediatelyOnDBWait: true }, options));
    }
    async Validate_Async_Safe(options) {
        var _a;
        try {
            await this.Validate_Async(options);
            this.validateError = undefined;
        }
        catch (ex) {
            this.validateError = ex;
            //return ex;
            return (_a = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _a !== void 0 ? _a : ex === null || ex === void 0 ? void 0 : ex.toString();
        }
    }
    /** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
    GetDBUpdates(parentHelper) {
        const helper = new DBHelper(parentHelper);
        this.DeclareDBUpdates(helper);
        /*const meta = GetCommandClassMetadata(this.constructor.name);
        if (meta.extraDBUpdates) {
            meta.extraDBUpdates(helper);
        }*/
        if (Command.augmentDBUpdates) {
            Command.augmentDBUpdates(this, helper);
        }
        const dbUpdates = helper.dbUpdates;
        return dbUpdates;
    }
    async PreRun() {
        //RemoveHelpers(this.payload);
        await this.Validate_Async();
    }
    /** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. */
    async RunLocally() {
        if (commandsWaitingToComplete_new.length > 0) {
            MaybeLog_Base(a => a.commands, l => l(`Queing command, since ${commandsWaitingToComplete_new.length} ${commandsWaitingToComplete_new.length == 1 ? "is" : "are"} already waiting for completion.${""}@type:`, this.constructor.name, " @payload(", this.payload, ")"));
        }
        commandsWaitingToComplete_new.push(this);
        while (commandsWaitingToComplete_new[0] != this) {
            await WaitTillCurrentCommandFinishes();
        }
        currentCommandRun_listeners = [];
        MaybeLog_Base(a => a.commands, l => l("Running command. @type:", this.constructor.name, " @payload(", this.payload, ")"));
        let dbUpdates;
        try {
            //this.runStartTime = Date.now();
            await this.PreRun();
            const helper = new DBHelper(undefined);
            dbUpdates = this.GetDBUpdates(helper);
            if (this.options.graph.ValidateDBData) {
                await this.Validate_LateHeavy(dbUpdates);
            }
            // FixDBUpdates(dbUpdates);
            // await store.firebase.helpers.DBRef().update(dbUpdates);
            await ApplyDBUpdates(dbUpdates, true, helper.DeferConstraints);
            // todo: make sure the db-changes we just made are reflected in our mobx store, *before* current command is marked as "completed" (else next command may start operating on not-yet-refreshed data)
            // MaybeLog(a=>a.commands, ()=>`Finishing command. @type:${this.constructor.name} @payload(${ToJSON(this.payload)}) @dbUpdates(${ToJSON(dbUpdates)})`);
            MaybeLog_Base(a => a.commands, l => l("Finishing command (locally). @type:", this.constructor.name, " @command(", this, ") @dbUpdates(", dbUpdates, ")"));
        } /*catch (ex) {
            console.error(`Hit error while executing command of type "${this.constructor.name}". @error:`, ex, "@payload:", this.payload);
        }*/
        finally {
            //const areOtherCommandsBuffered = currentCommandRun_listeners.length > 0;
            ArrayCE(commandsWaitingToComplete_new).Remove(this);
            NotifyListenersThatCurrentCommandFinished();
        }
        // later on (once set up on server), this will send the data back to the client, rather than return it
        return { returnData: this.returnData, dbUpdates };
    }
    /** Same as Run(), except with the server executing the command rather than the current context. */
    async RunOnServer() {
        const meta = GetCommandClassMetadata(this.constructor.name);
        const returnDataSchema = meta.returnSchema;
        //const returnData_propPairs = ObjectCE(returnDataSchema.properties).Pairs();
        MaybeLog_Base(a => a.commands, l => l("Running command (on server). @type:", this.constructor.name, " @payload(", this.payload, ")"));
        const fetchResult = await this.options.graph.subs.apollo.mutate({
            mutation: gql `
				mutation ${this.constructor.name}${WithBrackets(meta.Args_GetVarDefsStr())} {
					${this.constructor.name}${WithBrackets(meta.Args_GetArgsUsageStr())} {
						${meta.Return_GetFieldsStr()}
					}
				}
			`,
            variables: this.payload,
        });
        const returnData = CleanDBData(fetchResult.data[this.constructor.name]);
        AssertValidate(returnDataSchema, returnData, `Return-data for command did not match the expected shape. ReturnData: ${JSON.stringify(returnData, null, 2)}`);
        MaybeLog_Base(a => a.commands, l => l("Command completed (on server). @type:", this.constructor.name, " @command(", this, ") @fetchResult(", fetchResult, ")"));
        return returnData;
    }
    // standard validation of common paths/object-types; perhaps disable in production
    async Validate_LateHeavy(dbUpdates) {
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
    }
    CallX_Once(callTypeIdentifier, func) {
        if (!this.callXResults.has(callTypeIdentifier)) {
            this.callXResults.set(callTypeIdentifier, func());
        }
        return this.callXResults.get(callTypeIdentifier);
    }
    GenerateUUID_Once(path) {
        return this.CallX_Once(path, GenerateUUID);
    }
}
export class DBHelper {
    /*static TransferFlags(from: DBHelper, to: DBHelper, chainUp: boolean) {
        if (from.deferConstraints !== undefined) to.deferConstraints = from.deferConstraints;
    }*/
    constructor(parent) {
        // db-updates
        // ==========
        this.dbUpdates = [];
        this.parent = parent;
        // transfer flags from parent to child
        if (parent && parent.deferConstraints !== undefined)
            this.deferConstraints = parent.deferConstraints;
    }
    get DeferConstraints() { return this.deferConstraints; }
    set DeferConstraints(value) {
        this.deferConstraints = value;
        if (this.parent)
            this.parent.DeferConstraints = value;
    }
    // add multiple pre-made db-updates (eg. from subcommand)
    add(dbUpdates) {
        this.dbUpdates.push(...dbUpdates);
    }
    // helpers for adding one db-update
    set(path, value) {
        this.dbUpdates.push(new DBUpdate({ type: DBUpdateType.set, path, value }));
    }
}
