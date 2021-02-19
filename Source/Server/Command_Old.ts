import u from "updeep";
import {Clone, Assert, E, ObjectCE, ArrayCE, CE} from "js-vextensions";
import {maxDBUpdatesPerBatch, ApplyDBUpdates, ApplyDBUpdates_Local} from "../Utils/DatabaseHelpers";
import {MaybeLog_Base} from "../Utils/General";
import {FireOptions, defaultFireOptions, FireUserInfo} from "../Graphlink";
import {DBPath} from "../Utils/PathHelpers";
import {Command} from "./Command";

export const commandsWaitingToComplete = [] as Command_Old<any, any>[];

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

export abstract class Command_Old<Payload, ReturnData = void> {
	static defaultPayload = {};
	constructor(payload: Payload);
	constructor(opt: Partial<FireOptions>, payload: Payload);
	constructor(...args) {
		let options: Partial<FireOptions>, payload: Payload;
		if (args.length == 1) [payload] = args;
		else [options, payload] = args;
		const opt = E(defaultFireOptions, options!) as FireOptions;

		//this.userInfo = {id: opt.fire.userID}; // temp
		//this.userInfo = opt.fire.userInfo; // temp (needs rework to be server-compatible in future)
		this.type = this.constructor.name;
		this.options = opt;
		this.payload = E(this.constructor["defaultPayload"], payload);
	}
	//userInfo: FireUserInfo;
	get userInfo() { return this.options.fire.userInfo; }
	type: string;
	options: FireOptions;
	payload: Payload;

	//prepareStartTime: number;
	//runStartTime: number;
	returnData;

	// these methods are executed on the server (well, will be later)
	// ==========

	// parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload
	asSubcommand = false;
	MarkAsSubcommand() {
		this.asSubcommand = true;
		this.Validate_Early();
		return this;
	}

	/** [sync] Validates the payload data. (ie. the validation that doesn't require accessing the database) */
	Validate_Early() {}
	/** [async] Transforms the payload data, combines it with database data, and so on, in preparation for the database-updates-map construction. */
	abstract Prepare(): Promise<void>
	/** [async] Validates the prepared data, mostly using ajv shape-validation. */
	abstract Validate(): Promise<void>
	/** [sync] Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
	abstract GetDBUpdates(): {}

	async PreRun() {
		//RemoveHelpers(this.payload);
		this.Validate_Early(); // have this run locally, before sending, to save on bandwidth
		await this.Prepare();
		await this.Validate();
	}

	/** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. */
	async Run(maxUpdatesPerChunk = maxDBUpdatesPerBatch): Promise<ReturnData> {
		if (commandsWaitingToComplete.length > 0) {
			MaybeLog_Base(a=>a.commands, l=>l(`Queing command, since ${commandsWaitingToComplete.length} ${commandsWaitingToComplete.length == 1 ? "is" : "are"} already waiting for completion.${""
				}@type:`, this.constructor.name, " @payload(", this.payload, ")"));
		}
		commandsWaitingToComplete.push(this);
		while (commandsWaitingToComplete[0] != this) {
			await WaitTillCurrentCommandFinishes();
		}
		currentCommandRun_listeners = [];

		MaybeLog_Base(a=>a.commands, l=>l("Running command. @type:", this.constructor.name, " @payload(", this.payload, ")"));

		try {
			//this.runStartTime = Date.now();
			await this.PreRun();

			const dbUpdates = this.GetDBUpdates();
			if (this.options.fire.ValidateDBData) {
				await this.Validate_LateHeavy(dbUpdates);
			}
			// FixDBUpdates(dbUpdates);
			// await store.firebase.helpers.DBRef().update(dbUpdates);
			await ApplyDBUpdates(this.options, dbUpdates);

			// MaybeLog(a=>a.commands, ()=>`Finishing command. @type:${this.constructor.name} @payload(${ToJSON(this.payload)}) @dbUpdates(${ToJSON(dbUpdates)})`);
			MaybeLog_Base(a=>a.commands, l=>l("Finishing command. @type:", this.constructor.name, " @command(", this, ") @dbUpdates(", dbUpdates, ")"));
		} finally {
			//const areOtherCommandsBuffered = currentCommandRun_listeners.length > 0;
			ArrayCE(commandsWaitingToComplete).Remove(this);
			NotifyListenersThatCurrentCommandFinished();
		}

		// later on (once set up on server), this will send the data back to the client, rather than return it
		return this.returnData;
	}

	// standard validation of common paths/object-types; perhaps disable in production
	async Validate_LateHeavy(dbUpdates: any) {
		// validate "nodes/X"
		/* let nodesBeingUpdated = (dbUpdates.VKeys() as string[]).map(a=> {
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
		} */

		// locally-apply db-updates, then validate the result (for now, only works for already-loaded data paths)
		const oldData = Clone(this.options.fire.tree.AsRawData());
		const newData = ApplyDBUpdates_Local(oldData, dbUpdates);
		this.options.fire.ValidateDBData!(newData);
	}
}