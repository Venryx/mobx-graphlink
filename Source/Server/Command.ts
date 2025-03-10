import {gql} from "@apollo/client";
import {ArrayCE, Assert, CE, Clone, ConvertPathGetterFuncToPropChain, E, ModifyString, ObjectCE} from "js-vextensions";
import {GetAsync, GetAsync_Options} from "../Accessors/Helpers.js";
import {AssertValidate} from "../Extensions/JSONSchemaHelpers.js";
import {GenerateUUID} from "../Extensions/KeyGenerator.js";
import {defaultGraphRefs, GraphRefs} from "../Graphlink.js";
import {CleanDBData, GQLTypeShape, Graphlink, UserInfo} from "../index.js";
import {WithBrackets} from "../Tree/QueryParams.js";
import {n} from "../Utils/@Internal/Types.js";
import {DBPPath, PathOrPathGetterToPathSegments} from "../Utils/DB/DBPaths.js";
import {DBUpdate, DBUpdateType} from "../Utils/DB/DBUpdate.js";
import {DeepMap} from "../Utils/General/DeepMap.js";
import {MaybeLog_Base} from "../Utils/General/General.js";
import {GetCommandClassMetadata, GetCommandClassMetadatas} from "./CommandMetadata.js";

/*export const commandsWaitingToComplete_new = [] as Command<any, any>[];

let currentCommandRun_listeners = [] as {resolve, reject}[];
async function WaitTillCurrentCommandFinishes() {
	return new Promise((resolve, reject)=>{
		currentCommandRun_listeners.push({resolve, reject});
	});
}
function NotifyListenersThatCurrentCommandFinished() {
	const currentCommandRun_listeners_copy = currentCommandRun_listeners;
	currentCommandRun_listeners = [];
	for (const listener of currentCommandRun_listeners_copy) {
		listener.resolve();
	}
}*/

// type helpers
export type PayloadOf<T> = T extends Command<infer Payload> ? Payload : never;
export type ReturnDataOf<T> = T extends Command<infer Payload, infer ReturnData> ? ReturnData : never;

// require command return-value to always be an object; this provides more schema stability (eg. lets you change the return-data of a mutation, without breaking the contents of "legacy" keys)
export abstract class Command<Input, Response extends {[key: string]: any} = {}> {
	static augmentValidate?: (command: Command<any>)=>any;
	static augmentDBUpdates?: (command: Command<any>, db: DBHelper)=>any;

	constructor(payload: Input);
	constructor(options: Partial<GraphRefs>, payload: Input);
	constructor(...args) {
		let options: Partial<GraphRefs>, payload: Input;
		if (args.length == 1) [payload] = args;
		else [options, payload] = args;
		const opt = E(defaultGraphRefs, options!) as GraphRefs;

		this.type = this.constructor.name;
		this.options = opt;
		//this.payload = E(this.constructor["defaultPayload"], payload);
		// use Clone on the payload, so that behavior is consistent whether called locally or over the network
		const meta = GetCommandClassMetadata(this.constructor.name);
		this.input_orig = Clone(payload); // needed for safe inclusion in CommandRun entries (ie. in-db command-run recording)
		this.input = E(Clone(meta.defaultInput), Clone(payload));
	}
	//userInfo: FireUserInfo;
	_userInfo_override: UserInfo|null|undefined; // for use on server (so permissions are checked against the calling user's id rather than the server's )
	//_userInfo_override_set = false;
	get userInfo() {
		if (this.options.graph.onServer) {
			Assert(this._userInfo_override != null, `For commands being run on the server, user-info must be explicitly attached. @Command:${this.constructor.name}`);
			return this._userInfo_override;
		}
		return this.options.graph.userInfo!;
	}
	type: string;
	options: GraphRefs;
	input_orig: Input;
	input: Input;

	//prepareStartTime: number;
	//runStartTime: number;
	//returnData = {} as any;
	response = {} as Response;

	// these methods are executed on the server (well, will be later)
	// ==========

	/** The parent command, ie. the prior command that constructed this command. */
	parentCommand: Command<any, any>;
	/** Alias for the parent command, ie. the prior command that constructed this command. */
	get up() { return this.parentCommand; }
	Up<T>(type: new(..._)=>T) {
		return this.parentCommand ? CE(this.parentCommand).As(type) : null;
	}
	/** Parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload. [old; use IntegrateSubcommand instead] */
	MarkAsSubcommand(parentCommand: Command<any, any>) {
		this.parentCommand = parentCommand;
		this._userInfo_override = parentCommand._userInfo_override;
		//this.Validate_Early();
		return this;
	}
	/** Call this from within your command's Validate() method. */
	IntegrateSubcommand<T extends Command<any>>(
		fieldGetter: ()=>(T|n),
		fieldSetter: ((subcommand: T)=>any) | null,
		/** If a command is passed, the field is set every time (to the passed command); if a function is passed, the field is only set once (to the result of the function's first invokation). */
		subcommandOrCreator: T | (()=>T),
		preValidate?: (subcommand: T)=>any,
	) {
		let subcommand: T;
		if (typeof subcommandOrCreator == "function") {
			subcommand = fieldGetter() ?? subcommandOrCreator();
		} else {
			subcommand = subcommandOrCreator;
		}

		subcommand.MarkAsSubcommand(this);
		//const fieldName = CE(PathOrPathGetterToPathSegments(fieldGetter)).Last();
		if (fieldSetter) {
			fieldSetter(subcommand);
		} else {
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
	protected Validate(): void {}

	/** Last validation error, from passing "catchAndStoreError=true" to Validate_Full() or Validate_Async(). */
	validateError?: Error|string|undefined;
	get ValidateErrorStr(): string|undefined {
		const err = this.validateError;
		return err?.["message"] ?? err?.toString();
	}

	/** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
	Validate_Full() {
		const meta = GetCommandClassMetadata(this.constructor.name);
		AssertValidate(meta.inputSchema, this.input, "Payload is invalid.", {addSchemaObject: true});
		this.Validate();
		if (Command.augmentValidate) {
			Command.augmentValidate(this);
		}
		AssertValidate(meta.responseSchema, this.response, "Return-data is invalid.", {addSchemaObject: true});
	}
	Validate_Safe(): string|undefined {
		try {
			this.Validate_Full();
			this.validateError = undefined;
		} catch (ex) {
			this.validateError = ex;
			//return ex;
			return ex?.message ?? ex?.toString();
		}
	}
	async Validate_Async(options?: Partial<GraphRefs> & GetAsync_Options) {
		//await GetAsync(()=>this.Validate(), E({errorHandling: "ignore"}, IsNumber(maxIterations) && {maxIterations}));
		//await GetAsync(()=>this.Validate(), {errorHandling: "ignore", maxIterations: OmitIfFalsy(maxIterations)});
		//await GetAsync(()=>this.Validate_Full(), E({throwImmediatelyOnDBWait: true} as Partial<GetAsync_Options>, options));
		await GetAsync(()=>this.Validate_Full(), options);
	}
	async Validate_Async_Safe(options?: Partial<GraphRefs> & GetAsync_Options): Promise<string|undefined> {
		try {
			await this.Validate_Async(options);
			this.validateError = undefined;
		} catch (ex) {
			this.validateError = ex;
			//return ex;
			return ex?.message ?? ex?.toString();
		}
	}

	/** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
	GetDBUpdates(parentHelper: DBHelper) {
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
	DeclareDBUpdates(helper: DBHelper) {}

	async PreRun() {
		//RemoveHelpers(this.payload);
		await this.Validate_Async();
	}

	/** Creates a graphql request, and sends it, causing the commander to be executed on the server. */
	async RunOnServer(): Promise<Response> {
		const meta = GetCommandClassMetadata(this.constructor.name);
		const returnDataSchema = meta.responseSchema;
		//const returnData_propPairs = ObjectCE(returnDataSchema.properties).Pairs();

		MaybeLog_Base(a=>a.commands, l=>l("Running command (on server). @type:", this.constructor.name, " @payload(", this.input, ")"));

		Assert(Graphlink.instances.length == 1, "Command class currently only works if there is one Graphlink instance created in your program.");
		const inputType_server = Graphlink.instances[0].introspector.TypeShape(`${this.constructor.name}Input`);
		const input_final = Clone(this.input);

		// TEMP; hard-code special handling for an "entry" field atm
		if (input_final.entry) {
			const entry_final = input_final.entry;
			entry_final.extras ??= {};
			const extras_final = entry_final.extras;

			const inputType_server_entry = GQLTypeShape.GetInputFields(inputType_server).find(a=>a.name == "entry")!.type;
			for (const [key, value] of Object.entries(entry_final)) {
				// if server does not recognize the given field as a direct field, move it to the "extras" sub-map
				if (GQLTypeShape.GetInputFields(inputType_server_entry).find(a=>a.name == key) == null) {
					delete entry_final[key];
					extras_final[key] = value;
				}
			}
		}

		// TEMP; hard-code special handling for an "updates" field atm
		if (input_final.updates) {
			const updates_final = input_final.updates;
			updates_final.extras ??= {};
			const extras_final = updates_final.extras;

			const inputType_server_updates = GQLTypeShape.GetInputFields(inputType_server).find(a=>a.name == "updates")!.type;
			for (const [key, value] of Object.entries(updates_final)) {
				// if server does not recognize the given field as a direct field, move it to the "extras" sub-map
				if (GQLTypeShape.GetInputFields(inputType_server_updates).find(a=>a.name == key) == null) {
					delete updates_final[key];
					extras_final[key] = value;
				}
			}
		}

		const commandName_gql = ModifyString(this.constructor.name, m=>[m.startUpper_to_lower]);
		const fetchResult = await this.options.graph.subs.apollo.mutate({
			mutation: gql`
				mutation Command_${commandName_gql}${WithBrackets(meta.Args_GetVarDefsStr_New())} {
					${commandName_gql}${WithBrackets(meta.Args_GetArgsUsageStr_New())} {
						${meta.Response_GetFieldsStr()}
					}
				}
			`,
			variables: {input: input_final},
		});
		const returnData = CleanDBData(fetchResult.data[commandName_gql]);
		AssertValidate(returnDataSchema, returnData, `Return-data for command did not match the expected shape. ReturnData: ${JSON.stringify(returnData, null, 2)}`);

		MaybeLog_Base(a=>a.commands, l=>l("Command completed (on server). @type:", this.constructor.name, " @command(", this, ") @fetchResult(", fetchResult, ")"));

		return returnData as Response;
	}

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
	callXResults = new Map<string, any>();
	CallX_Once<T>(callTypeIdentifier: string, func: ()=>T) {
		if (!this.callXResults.has(callTypeIdentifier)) {
			this.callXResults.set(callTypeIdentifier, func());
		}
		return this.callXResults.get(callTypeIdentifier)! as T;
	}
	GenerateUUID_Once(path: string) {
		return this.CallX_Once(path, GenerateUUID);
	}
	/*generatedUUIDs = new Map<string, string>();
	GenerateUUID_Once(path: string) {
		if (!this.generatedUUIDs.has(path)) {
			this.generatedUUIDs.set(path, GenerateUUID());
		}
		return this.generatedUUIDs.get(path)!;
	}*/
}

export class DBHelper {
	/*static TransferFlags(from: DBHelper, to: DBHelper, chainUp: boolean) {
		if (from.deferConstraints !== undefined) to.deferConstraints = from.deferConstraints;
	}*/

	constructor(parent: DBHelper|undefined) {
		this.parent = parent;
		// transfer flags from parent to child
		if (parent && parent.deferConstraints !== undefined) this.deferConstraints = parent.deferConstraints;
	}
	parent: DBHelper|undefined;

	// flags
	private deferConstraints?: boolean;
	get DeferConstraints() { return this.deferConstraints; }
	set DeferConstraints(value: boolean|undefined) {
		this.deferConstraints = value;
		if (this.parent) this.parent.DeferConstraints = value;
	}

	// db-updates
	// ==========

	dbUpdates = [] as DBUpdate[];

	// add multiple pre-made db-updates (eg. from subcommand)
	add(dbUpdates: DBUpdate[]) {
		this.dbUpdates.push(...dbUpdates);
	}

	// helpers for adding one db-update
	set(path: DBPPath, value: any) {
		this.dbUpdates.push(new DBUpdate({type: DBUpdateType.set, path, value}));
	}
	/*delete(path: string, value: any) {
		this._dbUpdates.push(new DBUpdate({type: DBUpdateType.delete, path, value}));
	}*/
}