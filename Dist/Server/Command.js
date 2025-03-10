import { gql } from "@apollo/client";
import { Assert, CE, Clone, ConvertPathGetterFuncToPropChain, E, ModifyString } from "js-vextensions";
import { GetAsync } from "../Accessors/Helpers.js";
import { AssertValidate } from "../Extensions/JSONSchemaHelpers.js";
import { GenerateUUID } from "../Extensions/KeyGenerator.js";
import { defaultGraphRefs } from "../Graphlink.js";
import { CleanDBData, GQLTypeShape, Graphlink } from "../index.js";
import { WithBrackets } from "../Tree/QueryParams.js";
import { DBUpdate, DBUpdateType } from "../Utils/DB/DBUpdate.js";
import { MaybeLog_Base } from "../Utils/General/General.js";
import { GetCommandClassMetadata } from "./CommandMetadata.js";
// require command return-value to always be an object; this provides more schema stability (eg. lets you change the return-data of a mutation, without breaking the contents of "legacy" keys)
export class Command {
    constructor(...args) {
        //prepareStartTime: number;
        //runStartTime: number;
        //returnData = {} as any;
        this.response = {};
        // standard validation of common paths/object-types; perhaps disable in production
        /*async Validate_LateHeavy(dbUpdates: any) {
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
            }*#/
    
            // locally-apply db-updates, then validate the result (for now, only works for already-loaded data paths)
            const oldData = Clone(this.options.graph.tree.AsRawData());
            const newData = ApplyDBUpdates_Local(oldData, dbUpdates);
            this.options.graph.ValidateDBData!(newData);
        }*/
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
        this.input_orig = Clone(payload); // needed for safe inclusion in CommandRun entries (ie. in-db command-run recording)
        this.input = E(Clone(meta.defaultInput), Clone(payload));
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
    /*Up(type?: new(..._)=>Command<any>) {
        return CE(this.parentCommand).As(type);
    }*/
    /** Transforms the payload data (eg. combining it with existing db-data) in preparation for constructing the db-updates-map, while also validating user permissions and such along the way. */
    Validate() { }
    get ValidateErrorStr() {
        var _a;
        const err = this.validateError;
        return (_a = err === null || err === void 0 ? void 0 : err["message"]) !== null && _a !== void 0 ? _a : err === null || err === void 0 ? void 0 : err.toString();
    }
    /** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
    Validate_Full() {
        const meta = GetCommandClassMetadata(this.constructor.name);
        AssertValidate(meta.inputSchema, this.input, "Payload is invalid.", { addSchemaObject: true });
        this.Validate();
        if (Command.augmentValidate) {
            Command.augmentValidate(this);
        }
        AssertValidate(meta.responseSchema, this.response, "Return-data is invalid.", { addSchemaObject: true });
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
        //await GetAsync(()=>this.Validate_Full(), E({throwImmediatelyOnDBWait: true} as Partial<GetAsync_Options>, options));
        await GetAsync(() => this.Validate_Full(), options);
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
    DeclareDBUpdates(helper) { }
    async PreRun() {
        //RemoveHelpers(this.payload);
        await this.Validate_Async();
    }
    /** Creates a graphql request, and sends it, causing the commander to be executed on the server. */
    async RunOnServer() {
        var _a, _b;
        const meta = GetCommandClassMetadata(this.constructor.name);
        const returnDataSchema = meta.responseSchema;
        //const returnData_propPairs = ObjectCE(returnDataSchema.properties).Pairs();
        MaybeLog_Base(a => a.commands, l => l("Running command (on server). @type:", this.constructor.name, " @payload(", this.input, ")"));
        Assert(Graphlink.instances.length == 1, "Command class currently only works if there is one Graphlink instance created in your program.");
        const inputType_server = Graphlink.instances[0].introspector.TypeShape(`${this.constructor.name}Input`);
        const input_final = Clone(this.input);
        // TEMP; hard-code special handling for an "entry" field atm
        if (input_final.entry) {
            const entry_final = input_final.entry;
            (_a = entry_final.extras) !== null && _a !== void 0 ? _a : (entry_final.extras = {});
            const extras_final = entry_final.extras;
            const inputType_server_entry = GQLTypeShape.GetInputFields(inputType_server).find(a => a.name == "entry").type;
            for (const [key, value] of Object.entries(entry_final)) {
                // if server does not recognize the given field as a direct field, move it to the "extras" sub-map
                if (GQLTypeShape.GetInputFields(inputType_server_entry).find(a => a.name == key) == null) {
                    delete entry_final[key];
                    extras_final[key] = value;
                }
            }
        }
        // TEMP; hard-code special handling for an "updates" field atm
        if (input_final.updates) {
            const updates_final = input_final.updates;
            (_b = updates_final.extras) !== null && _b !== void 0 ? _b : (updates_final.extras = {});
            const extras_final = updates_final.extras;
            const inputType_server_updates = GQLTypeShape.GetInputFields(inputType_server).find(a => a.name == "updates").type;
            for (const [key, value] of Object.entries(updates_final)) {
                // if server does not recognize the given field as a direct field, move it to the "extras" sub-map
                if (GQLTypeShape.GetInputFields(inputType_server_updates).find(a => a.name == key) == null) {
                    delete updates_final[key];
                    extras_final[key] = value;
                }
            }
        }
        const commandName_gql = ModifyString(this.constructor.name, m => [m.startUpper_to_lower]);
        const fetchResult = await this.options.graph.subs.apollo.mutate({
            mutation: gql `
				mutation Command_${commandName_gql}${WithBrackets(meta.Args_GetVarDefsStr_New())} {
					${commandName_gql}${WithBrackets(meta.Args_GetArgsUsageStr_New())} {
						${meta.Response_GetFieldsStr()}
					}
				}
			`,
            variables: { input: input_final },
        });
        const returnData = CleanDBData(fetchResult.data[commandName_gql]);
        AssertValidate(returnDataSchema, returnData, `Return-data for command did not match the expected shape. ReturnData: ${JSON.stringify(returnData, null, 2)}`);
        MaybeLog_Base(a => a.commands, l => l("Command completed (on server). @type:", this.constructor.name, " @command(", this, ") @fetchResult(", fetchResult, ")"));
        return returnData;
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
