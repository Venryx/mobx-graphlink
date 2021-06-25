import { Knex } from "knex";
export declare function MGLClass(opts?: {
    name?: string;
    table?: string;
    schemaDeps?: string[];
}, schemaExtrasOrGetter?: Object | (() => Object), initFunc_pre?: (t: Knex.TableBuilder) => any): any;
export declare type Field_Extras = {
    /** If true, field will be added to the list of required properties. */
    req?: boolean;
};
export declare function Field(schemaOrGetter: Object | (() => Object), extras?: Field_Extras): (target: any, propertyKey: string) => void;
export declare function DB(initFunc: (t: Knex.TableBuilder, n: string) => any): (target: any, propertyKey: string) => void;
