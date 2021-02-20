import AJV from "ajv";
export declare const ajv: AJV_Extended;
export declare const collection_docSchemaName: Map<string, string>;
export declare function Col(docSchemaName: string): <T>(targetClass: T, propertyKey: string) => void;
export declare function GetTypePolicyFieldsMappingSingleDocQueriesToCache(): {};
export declare function Schema(schema: any): any;
export declare const schemaEntryJSONs: {};
export declare function AddSchema(name: string, schemaOrGetter: Object | (() => Object)): any;
export declare function AddSchema(name: string, dependencySchemas: string[], schemaGetter: () => Object): any;
export declare function GetSchemaJSON(name: string): any;
export declare function WaitTillSchemaAdded(schemaName: string): Promise<void>;
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
export declare function Validate_Full(schemaObject: Object, schemaName: string | null, data: any): string | null | undefined;
export declare class AssertValidateOptions {
    addErrorsText: boolean;
    addSchemaName: boolean;
    addDataStr: boolean;
    allowOptionalPropsToBeNull: boolean;
    useAssertV: boolean;
}
export declare function AssertValidate(schemaNameOrJSON: string | Object, data: any, failureMessageOrGetter: string | ((errorsText: string) => string), opt?: AssertValidateOptions): void;
export declare function AssertValidate_Full(schemaObject: Object, schemaName: string | null, data: any, failureMessageOrGetter: string | ((errorsText: string | undefined) => string), opt?: Partial<AssertValidateOptions>): void;
export declare function Schema_WithOptionalPropsAllowedNull(schema: any): any;
export declare function GetInvalidPropPaths(data: Object, schemaObject: Object): {
    propPath: string;
    error: AJV.ErrorObject;
}[];
export {};
