import { Knex } from "knex";
import { BailMessage } from "../Utils/BailManager.js";
export declare let BailHandler_loadingUI_default: BailHandler;
export declare function BailHandler_loadingUI_default_Set(value: BailHandler): void;
export declare type BailHandler = (bailMessage: BailMessage) => any;
export declare class BailHandler_Options {
    loadingUI?: BailHandler;
}
export declare function BailHandler(targetClass: Function): any;
export declare function BailHandler(options?: Partial<BailHandler_Options>): any;
export declare function MGLClass(opts?: {
    name?: string;
    table?: string;
    schemaDeps?: string[];
}, schemaExtrasOrGetter?: Object | (() => Object), initFunc_pre?: (t: Knex.TableBuilder) => any): (constructor: Function) => void;
export declare type Field_Extras = {
    /** If true, field will be added to the list of required properties. */
    req?: boolean;
};
export declare function Field(schemaOrGetter: Object | (() => Object), extras?: Field_Extras): (target: any, propertyKey: string) => void;
declare module "knex" {
    namespace Knex {
        interface ColumnBuilder {
            DeferRef: (this: Knex.ColumnBuilder) => Knex.ColumnBuilder;
        }
    }
}
export declare function DB(initFunc: (t: Knex.TableBuilder, n: string) => any): (target: any, propertyKey: string) => void;
