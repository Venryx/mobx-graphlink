/*import {Clone, Assert, E, ObjectCE, ArrayCE, CE, OmitIfFalsy} from "js-vextensions";
import {maxDBUpdatesPerBatch, ApplyDBUpdates, ApplyDBUpdates_Local} from "../Utils/DatabaseHelpers";
import {MaybeLog_Base} from "../Utils/General";
import {GraphOptions, defaultGraphOptions} from "../Graphlink";
import {GetAsync, GetAsync_Options} from "../Accessors/Helpers";

export const commandsWaitingToComplete_new = [] as Command<any, any>[];

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
}

export abstract class Command<Payload, ReturnData = void> {
	static defaultPayload = {};
	constructor(payload: Payload);
	constructor(options: Partial<GraphOptions>, payload: Payload);
	constructor(...args) {
		let options: Partial<GraphOptions>, payload: Payload;
		if (args.length == 1) [payload] = args;
		else [options, payload] = args;
		const opt = E(defaultGraphOptions, options!) as GraphOptions;

		this.type = this.constructor.name;
		this.options = opt;
		//this.payload = E(this.constructor["defaultPayload"], payload);
		// use Clone on the payload, so that behavior is consistent whether called locally or over the network
		this.payload = E(Clone(this.constructor["defaultPayload"]), Clone(payload));
	}
	type: string;
	options: GraphOptions;
	payload: Payload;

	//prepareStartTime: number;
	//runStartTime: number;
	returnData;

	// these methods are executed on the server (well, will be later)
	// ==========

	// parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload
	parentCommand: Command<any, any>;
	MarkAsSubcommand(parentCommand: Command<any, any>) {
		this.parentCommand = parentCommand;
		//this.Validate_Early();
		return this;
	}

	/** Transforms the payload data (eg. combining it with existing db-data) in preparation for constructing the db-updates-map, while also validating user permissions and such along the way. *#/
	abstract Validate(): void;
	/** Last validation error, from calling Validate_Safe(). *#/
	validateError: string|null;
	Validate_Safe() {
		try {
			this.Validate();
			this.validateError = null;
			return null;
		} catch (ex) {
			this.validateError = ex;
			return ex;
		}
	}
	async Validate_Async(options?: Partial<GraphOptions> & GetAsync_Options) {
		//await GetAsync(()=>this.Validate(), E({errorHandling: "ignore"}, IsNumber(maxIterations) && {maxIterations}));
		//await GetAsync(()=>this.Validate(), {errorHandling: "ignore", maxIterations: OmitIfFalsy(maxIterations)});
		await GetAsync(()=>this.Validate(), E({errorHandling: "ignore"}, options));
	}
	/** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) *#/
	abstract GetDBUpdates(): {}

	async PreRun() {
		//RemoveHelpers(this.payload);
		await this.Validate_Async();
	}

	/** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. *#/
	async Run(maxUpdatesPerChunk = maxDBUpdatesPerBatch): Promise<ReturnData> {
		if (commandsWaitingToComplete_new.length > 0) {
			MaybeLog_Base(a=>a.commands, l=>l(`Queing command, since ${commandsWaitingToComplete_new.length} ${commandsWaitingToComplete_new.length == 1 ? "is" : "are"} already waiting for completion.${""
				}@type:`, this.constructor.name, " @payload(", this.payload, ")"));
		}
		commandsWaitingToComplete_new.push(this);
		while (commandsWaitingToComplete_new[0] != this) {
			await WaitTillCurrentCommandFinishes();
		}
		currentCommandRun_listeners = [];

		MaybeLog_Base(a=>a.commands, l=>l("Running command. @type:", this.constructor.name, " @payload(", this.payload, ")"));

		try {
			//this.runStartTime = Date.now();
			await this.PreRun();

			const dbUpdates = this.GetDBUpdates();
			if (this.options.graph.ValidateDBData) {
				await this.Validate_LateHeavy(dbUpdates);
			}
			// FixDBUpdates(dbUpdates);
			// await store.firebase.helpers.DBRef().update(dbUpdates);
			await ApplyDBUpdates(this.options, dbUpdates);

			// MaybeLog(a=>a.commands, ()=>`Finishing command. @type:${this.constructor.name} @payload(${ToJSON(this.payload)}) @dbUpdates(${ToJSON(dbUpdates)})`);
			MaybeLog_Base(a=>a.commands, l=>l("Finishing command. @type:", this.constructor.name, " @command(", this, ") @dbUpdates(", dbUpdates, ")"));
		} finally {
			//const areOtherCommandsBuffered = currentCommandRun_listeners.length > 0;
			ArrayCE(commandsWaitingToComplete_new).Remove(this);
			NotifyListenersThatCurrentCommandFinished();
		}

		// later on (once set up on server), this will send the data back to the client, rather than return it
		return this.returnData;
	}

	// standard validation of common paths/object-types; perhaps disable in production
	async Validate_LateHeavy(dbUpdates: any) {
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
	}
}*/