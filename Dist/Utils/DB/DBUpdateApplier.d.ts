import { DBUpdate } from "./DBUpdate.js";
export declare function FinalizeDBUpdates(dbUpdates: DBUpdate[], simplifyDBUpdates?: boolean): DBUpdate[];
export declare function AssertDBUpdateIsValid(update: DBUpdate): void;
export declare function ApplyDBUpdates_Local(dbData: any, dbUpdates: DBUpdate[], simplifyDBUpdates?: boolean): any;
export declare function ApplyDBUpdates(dbUpdates: DBUpdate[], simplifyDBUpdates?: boolean): Promise<void>;
