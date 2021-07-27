import type { Knex } from "knex";
import { BailMessage } from "../Utils/General/BailManager.js";
import { n } from "../Utils/@Internal/Types.js";
export declare function TableNameToDocSchemaName(tableName: string, errorIfMissing?: boolean): string;
export declare function TableNameToGraphQLDocRetrieverKey(tableName: string): string;
export declare let BailHandler_loadingUI_default: BailHandler;
export declare function BailHandler_loadingUI_default_Set(value: BailHandler): void;
export declare type BailInfo = {
    comp: any;
    bailMessage: BailMessage;
};
export declare type BailHandler = (info: BailInfo) => any;
export declare class BailHandler_Options {
    loadingUI?: BailHandler;
}
export declare function BailHandler(targetClass: Function): any;
export declare function BailHandler(options?: Partial<BailHandler_Options>): any;
export declare class MGLObserver_Options {
    bailHandler: boolean;
    bailHandler_opts?: BailHandler_Options;
}
export declare function MGLObserver(targetClass: Function): any;
export declare function MGLObserver(options: Partial<MGLObserver_Options> | n): any;
export declare const mglClasses: Function[];
export declare function GetMGLClass(name: string): Function | undefined;
export declare function MGLClass(opts?: {
    name?: string;
    table?: string;
    schemaDeps?: string[];
}, schemaExtrasOrGetter?: Object | (() => Object), initFunc_pre?: (t: Knex.TableBuilder) => any): (constructor: Function) => void;
export declare type Field_Extras = {
    /** If true, two changes are made:
    1) Field is removed from the list of required properties. (fields are required by default)
    2) Field's schema is changed to accept either the listed type, or null. (as elsewhere, null and undefined/not-present are meant to be treated the same) */
    opt?: boolean;
};
/**
Marks the given field to be part of the json-schema for the current class.
Note that the "requiredness" of properties should be based on what's valid for an entry during submission to the database (ie. within the type's main AddXXX command);
    this is different than the TS "?" marker, which should match with the requiredness of the property when already in the db. (for new entries, the TS constructors already make all props optional)
*/
export declare function Field(schemaOrGetter: Object | (() => Object), extras?: Field_Extras): (target: any, propertyKey: string) => void;
export declare type DeferRef_Options = {
    enforceAtTransactionEnd?: boolean;
};
declare module "knex" {
    namespace Knex {
        interface ColumnBuilder {
            DeferRef: (this: Knex.ColumnBuilder, opts?: DeferRef_Options) => Knex.ColumnBuilder;
        }
    }
}
export declare type DBInitFunc = (t: Knex.TableBuilder, n: string) => any;
/**
Marks the given field to be a database column for the current class. (ie. in its generated table definition)
Note that "notNullable()" is called for these fields automatically; if you want it to be optional/nullable within the db, add ".nullable()" to the chain.
*/
export declare function DB(initFunc: DBInitFunc): (target: any, propertyKey: string) => void;
export declare function GetFieldDBInit(constructor: Function, fieldName: string): DBInitFunc | undefined;
