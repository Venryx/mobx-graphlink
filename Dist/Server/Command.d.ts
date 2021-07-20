import { GraphOptions } from "../Graphlink.js";
import { GetAsync_Options } from "../Accessors/Helpers.js";
import { DBUpdate } from "../Utils/DB/DBUpdate.js";
import { UserInfo } from "../index.js";
import { DBPPath } from "../Utils/DB/DBPaths.js";
export declare const commandsWaitingToComplete_new: Command<any, any>[];
export declare abstract class Command<Payload, ReturnData extends {
    [key: string]: any;
} = {}> {
    constructor(payload: Payload);
    constructor(options: Partial<GraphOptions>, payload: Payload);
    _userInfo_override: UserInfo | null | undefined;
    _userInfo_override_set: boolean;
    get userInfo(): UserInfo;
    type: string;
    options: GraphOptions;
    payload: Payload;
    returnData: ReturnData;
    parentCommand: Command<any, any>;
    MarkAsSubcommand(parentCommand: Command<any, any>): this;
    /** Transforms the payload data (eg. combining it with existing db-data) in preparation for constructing the db-updates-map, while also validating user permissions and such along the way. */
    protected abstract Validate(): void;
    /** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
    Validate_Full(): void;
    /** Last validation error, from calling Validate_Safe(). */
    validateError: string | null;
    Validate_Safe(): any;
    Validate_Async(options?: Partial<GraphOptions> & GetAsync_Options): Promise<void>;
    /** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
    GetDBUpdates(): DBUpdate[];
    abstract DeclareDBUpdates(helper: DBHelper): any;
    PreRun(): Promise<void>;
    /** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. */
    RunLocally(): Promise<ReturnData>;
    /** Same as Run(), except with the server executing the command rather than the current context. */
    RunOnServer(): Promise<ReturnData>;
    Validate_LateHeavy(dbUpdates: any): Promise<void>;
}
export declare class DBHelper {
    _dbUpdates: DBUpdate[];
    add(dbUpdates: DBUpdate[]): void;
    set(path: DBPPath, value: any): void;
}
