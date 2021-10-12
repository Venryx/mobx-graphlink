import { DBUpdate } from "./DBUpdate.js";
export declare function FinalizeDBUpdates(dbUpdates: DBUpdate[], simplifyDBUpdates?: boolean): DBUpdate[];
/** Checks that various properties of the db-update are valid. (only checks properties discernable without referencing update-object-external data like schemas) */
export declare function AssertDBUpdateIsValid(update: DBUpdate): void;
export declare function ApplyDBUpdates_Local(dbData: any, dbUpdates: DBUpdate[], simplifyDBUpdates?: boolean): any;
export declare function ApplyDBUpdates(dbUpdates: DBUpdate[], simplifyDBUpdates?: boolean, deferConstraints?: boolean): Promise<void>;
