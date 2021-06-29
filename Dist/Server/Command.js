var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Clone, E, ArrayCE } from "js-vextensions";
import { ApplyDBUpdates, ApplyDBUpdates_Local } from "../Utils/DatabaseHelpers.js";
import { MaybeLog_Base } from "../Utils/General.js";
import { defaultGraphOptions } from "../Graphlink.js";
import { GetAsync } from "../Accessors/Helpers.js";
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
export class Command {
    constructor(...args) {
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
        this.payload = E(Clone(this.constructor["defaultPayload"]), Clone(payload));
    }
    //userInfo: FireUserInfo;
    get userInfo() { return this.options.graph.userInfo; }
    MarkAsSubcommand(parentCommand) {
        this.parentCommand = parentCommand;
        //this.Validate_Early();
        return this;
    }
    Validate_Safe() {
        try {
            this.Validate();
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
            yield GetAsync(() => this.Validate(), E({ errorHandling: "ignore", throwImmediatelyOnDBWait: true }, options));
        });
    }
    PreRun() {
        return __awaiter(this, void 0, void 0, function* () {
            //RemoveHelpers(this.payload);
            yield this.Validate_Async();
        });
    }
    /** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. */
    Run() {
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
                yield ApplyDBUpdates(this.options, dbUpdates);
                // MaybeLog(a=>a.commands, ()=>`Finishing command. @type:${this.constructor.name} @payload(${ToJSON(this.payload)}) @dbUpdates(${ToJSON(dbUpdates)})`);
                MaybeLog_Base(a => a.commands, l => l("Finishing command. @type:", this.constructor.name, " @command(", this, ") @dbUpdates(", dbUpdates, ")"));
            }
            finally {
                //const areOtherCommandsBuffered = currentCommandRun_listeners.length > 0;
                ArrayCE(commandsWaitingToComplete_new).Remove(this);
                NotifyListenersThatCurrentCommandFinished();
            }
            // later on (once set up on server), this will send the data back to the client, rather than return it
            return this.returnData;
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
}
Command.defaultPayload = {};
