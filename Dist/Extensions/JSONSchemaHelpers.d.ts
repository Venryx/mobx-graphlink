import AJV from "ajv";
import { JSONSchema7 } from "json-schema";
export declare const ajv: AJV_Extended;
export declare const collection_docSchemaName: Map<string, string>;
export declare function GetTypePolicyFieldsMappingSingleDocQueriesToCache(): {};
export declare function NewSchema(schema: any): any;
declare type JSONSchemaProperties = {
    [k: string]: JSONSchema7;
};
/** Specify required props by adding a "$" to the start of the prop name. */
export declare function SimpleSchema(props: JSONSchemaProperties): any;
export declare const schemaEntryJSONs: {};
export declare function AddSchema(name: string, schemaOrGetter: JSONSchema7 | (() => JSONSchema7)): any;
export declare function AddSchema(name: string, schemaDeps: string[] | undefined, schemaGetter: () => JSONSchema7): any;
export declare function GetSchemaJSON(name: string): JSONSchema7;
export declare type SchemaModifiers = {
    includeOnly?: string[];
};
export declare function DeriveJSONSchema(typeName: string, modifiers: SchemaModifiers): Object;
export declare function WaitTillSchemaAdded(schemaName: string): Promise<void> | null;
declare type AJV_Extended = AJV.Ajv & {
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
    error: AJV.ErrorObject;
}[];
export {};
