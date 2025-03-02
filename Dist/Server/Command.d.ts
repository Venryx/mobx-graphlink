import { GetAsync_Options } from "../Accessors/Helpers.js";
import { GraphRefs } from "../Graphlink.js";
import { UserInfo } from "../index.js";
import { n } from "../Utils/@Internal/Types.js";
import { DBPPath } from "../Utils/DB/DBPaths.js";
import { DBUpdate } from "../Utils/DB/DBUpdate.js";
export type PayloadOf<T> = T extends Command<infer Payload> ? Payload : never;
export type ReturnDataOf<T> = T extends Command<infer Payload, infer ReturnData> ? ReturnData : never;
export declare abstract class Command<Input, Response extends {
    [key: string]: any;
} = {}> {
    static augmentValidate?: (command: Command<any>) => any;
    static augmentDBUpdates?: (command: Command<any>, db: DBHelper) => any;
    constructor(payload: Input);
    constructor(options: Partial<GraphRefs>, payload: Input);
    _userInfo_override: UserInfo | null | undefined;
    get userInfo(): UserInfo;
    type: string;
    options: GraphRefs;
    input_orig: Input;
    input: Input;
    response: Response;
    /** The parent command, ie. the prior command that constructed this command. */
    parentCommand: Command<any, any>;
    /** Alias for the parent command, ie. the prior command that constructed this command. */
    get up(): Command<any, any>;
    Up<T>(type: new (..._: any[]) => T): T | null;
    /** Parent commands should call MarkAsSubcommand() immediately after setting a subcommand's payload. [old; use IntegrateSubcommand instead] */
    MarkAsSubcommand(parentCommand: Command<any, any>): this;
    /** Call this from within your command's Validate() method. */
    IntegrateSubcommand<T extends Command<any>>(fieldGetter: () => (T | n), fieldSetter: ((subcommand: T) => any) | null, 
    /** If a command is passed, the field is set every time (to the passed command); if a function is passed, the field is only set once (to the result of the function's first invokation). */
    subcommandOrCreator: T | (() => T), preValidate?: (subcommand: T) => any): void;
    /** Transforms the payload data (eg. combining it with existing db-data) in preparation for constructing the db-updates-map, while also validating user permissions and such along the way. */
    protected Validate(): void;
    /** Last validation error, from passing "catchAndStoreError=true" to Validate_Full() or Validate_Async(). */
    validateError?: Error | string | undefined;
    get ValidateErrorStr(): string | undefined;
    /** Same as the command-provided Validate() function, except also validating the payload and return-data against their schemas. */
    Validate_Full(): void;
    Validate_Safe(): string | undefined;
    Validate_Async(options?: Partial<GraphRefs> & GetAsync_Options): Promise<void>;
    Validate_Async_Safe(options?: Partial<GraphRefs> & GetAsync_Options): Promise<string | undefined>;
    /** Retrieves the actual database updates that are to be made. (so we can do it in one atomic call) */
    GetDBUpdates(parentHelper: DBHelper): DBUpdate[];
    DeclareDBUpdates(helper: DBHelper): void;
    PreRun(): Promise<void>;
    /** Creates a graphql request, and sends it, causing the commander to be executed on the server. */
    RunOnServer(): Promise<Response>;
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
