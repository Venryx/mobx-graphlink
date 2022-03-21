import Ajv from "ajv";
import { JSONSchema7 } from "json-schema";
export declare const ajv: AJV_Extended;
export declare const collection_docSchemaName: Map<string, string>;
export declare function GetTypePolicyFieldsMappingSingleDocQueriesToCache(): {};
export declare function NewSchema(schema: any, allowInferTypeObject?: boolean): any;
declare type JSONSchemaProperties = {
    [k: string]: JSONSchema7;
};
/** Specify required props by adding a "$" to the start of the prop name. */
export declare function SimpleSchema(props: JSONSchemaProperties): any;
export declare const schemaEntryJSONs: Map<string, JSONSchema7>;
/**
Adds the given schema to the schema collection.
Note that the "requiredness" of properties should be based on what's valid for an entry during submission to the database. (ie. within the type's main AddXXX command)
*/
export declare function AddSchema(name: string, schemaOrGetter: JSONSchema7 | (() => JSONSchema7)): Ajv | Promise<Ajv>;
export declare function AddSchema(name: string, schemaDeps: string[] | null | undefined, schemaGetter: () => JSONSchema7): Ajv | Promise<Ajv>;
export declare function GetSchemaJSON(name: string, errorOnMissing?: boolean): JSONSchema7;
export declare type SchemaModifiers<T> = {
    includeOnly?: Array<keyof T>;
    makeOptional?: Array<keyof T>;
    /** This is applied prior to makeRequired[_all] -- so they can be combined to make X required, and all else optional. */
    makeOptional_all?: boolean;
    makeRequired?: Array<keyof T>;
    makeRequired_all?: boolean;
};
export declare function DeriveJSONSchema<T extends {
    [key: string]: any;
}>(typeClass: new (..._: any[]) => T, modifiers: SchemaModifiers<T>): Object;
/** Helper for compile-time type-checking. At runtime, it simply returns the passed-in key-array. */
export declare function ClassKeys<T extends {
    [key: string]: any;
}>(...keys: Array<keyof T>): (keyof T)[];
export declare function RunXOnceSchemasAdded(schemaDeps: string[], funcX: () => void): void;
export declare function WaitTillSchemaAdded(schemaName: string): Promise<void> | null;
declare type AJV_Extended = Ajv & {
    FullErrorsText(): string;
};
export declare type AJVExtraCheckFunc = (item: any) => string;
export declare const ajvExtraChecks: {
    [key: string]: AJVExtraCheckFunc[];
};
export declare function AddAJVExtraCheck(schemaName: string, extraCheckFunc: AJVExtraCheckFunc): void;
export declare function ValidateAJVExtraChecks(schemaName: string, data: any): string | null | undefined;
/** Returns null if the supplied data matches the schema. Else, returns error message. */
export declare function Validate(schemaName: string, data: any): string | null | undefined;
/** Returns null if the supplied data matches the schema. Else, returns error message. */
export declare function Validate_Full(schemaObject: JSONSchema7, schemaName: string | null, data: any): string | null | undefined;
export declare class AssertValidateOptions {
    addErrorsText: boolean;
    addSchemaName: boolean;
    addSchemaObject: boolean;
    addDataStr: boolean;
    allowOptionalPropsToBeNull: boolean;
    useAssertV: boolean;
}
export declare function AssertValidate(schemaNameOrJSON: string | JSONSchema7, data: any, failureMessageOrGetter: string | ((errorsText: string) => string), opt?: Partial<AssertValidateOptions>): void;
export declare function AssertValidate_Full(schemaObject: JSONSchema7, schemaName: string | null, data: any, failureMessageOrGetter: string | ((errorsText: string | undefined) => string), opt?: Partial<AssertValidateOptions>): void;
export declare function Schema_WithOptionalPropsAllowedNull(schema: any): any;
export declare function GetInvalidPropPaths(data: Object, schemaObject: Object): {
    propPath: string;
    error: import("ajv").ErrorObject<string, Record<string, any>, unknown>;
}[];
export declare function IsJSONSchemaScalar(typeStr: string | undefined): boolean;
export declare function IsJSONSchemaOfTypeScalar(jsonSchema: JSONSchema7): boolean;
export declare function JSONSchemaScalarTypeToGraphQLScalarType(jsonSchemaScalarType: string): "Boolean" | "Int" | "Float" | "String" | undefined;
export {};
