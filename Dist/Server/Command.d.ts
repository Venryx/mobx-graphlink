import { GetAsync_Options } from "../Accessors/Helpers.js";
import { GraphOptions } from "../Graphlink.js";
import { UserInfo } from "../index.js";
import { DBPPath } from "../Utils/DB/DBPaths.js";
import { DBUpdate } from "../Utils/DB/DBUpdate.js";
export declare const commandsWaitingToComplete_new: Command<any, any>[];
export declare abstract class Command<Payload, ReturnData extends {
    [key: string]: any;
} = {}> {
    static augmentValidate?: (command: Command<any>) => any;
    static augmentDBUpdates?: (command: Command<any>, db: DBHelper) => any;
    constructor(payload: Payload);
    constructor(options: Partial<GraphOptions>, payload: Payload);
    _userInfo_override: UserInfo | null | undefined;
    get userInfo(): UserInfo;
    type: string;
    options: GraphOptions;
    payload_orig: Payload;
    payload: Payload;
    returnData: ReturnData;
    /** The parent command, ie. the prior command that constructed this command. */
    parentCommand: Command<any, any>;
    /** Alias for the parent command, ie. the prior command that constructed this command. */
    get up(): Command<any, any>;
    Up<T>(type: new (..._: any[]) => T): T | null;
    /** Parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload. */
    MarkAsSubcommand(parentCommand: Command<any, any>): this;
    /** Transforms the payload data (eg. combining it with existing db-data) in preparation for constructing the db-updates-map, while also validating user permissions and such along the way. */
    protected abstract Validate(): void;
    /** Last validation error, from passing "catchAndStoreError=true" to Validate_Full() or Validate_Async(). */
    validateError?: Error | string | undefined;
    get ValidateErrorStr(): string | undefined;
    /** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
    Validate_Full(): void;
    Validate_Safe(): string | undefined;
    Validate_Async(options?: Partial<GraphOptions> & GetAsync_Options): Promise<void>;
    Validate_Async_Safe(options?: Partial<GraphOptions> & GetAsync_Options): Promise<string | undefined>;
    /** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
    GetDBUpdates(parentHelper: DBHelper): DBUpdate[];
    abstract DeclareDBUpdates(helper: DBHelper): any;
    PreRun(): Promise<void>;
    /** [async] Validates the data, prepares it, and executes it -- thus applying it into the database. */
    RunLocally(): Promise<ReturnData>;
    /** Same as Run(), except with the server executing the command rather than the current context. */
    RunOnServer(): Promise<ReturnData>;
    Validate_LateHeavy(dbUpdates: any): Promise<void>;
    callXResults: Map<string, any>;
    CallX_Once<T>(callTypeIdentifier: string, func: () => T): T;
    GenerateUUID_Once(path: string): string;
}
export declare class DBHelper {
    constructor(parent: DBHelper | undefined);
    parent: DBHelper | undefined;
    private deferConstraints?;
    get DeferConstraints(): boolean | undefined;
    set DeferConstraints(value: boolean | undefined);
    dbUpdates: DBUpdate[];
    add(dbUpdates: DBUpdate[]): void;
    set(path: DBPPath, value: any): void;
}
