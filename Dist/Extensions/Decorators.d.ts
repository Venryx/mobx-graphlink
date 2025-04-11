import React from "react";
import { BailError } from "../Utils/General/BailManager.js";
import { n } from "../Utils/@Internal/Types.js";
import { Graphlink } from "../index.js";
export declare function TableNameToDocSchemaName(tableName: string, errorIfMissing?: boolean): string;
export declare function TableNameToGraphQLDocRetrieverKey(tableName: string): string;
export declare let BailHandler_loadingUI_default: BailHandler;
export declare function BailHandler_loadingUI_default_Set(value: BailHandler): void;
export type BailInfo = {
    comp: any;
    bailMessage: BailError | n;
};
export type BailHandler = (info: BailInfo) => any;
export declare class BailHandler_Options {
    loadingUI?: BailHandler;
    storeMetadata: boolean;
}
export declare function BailHandler(targetClass: Function): any;
export declare function BailHandler(options?: Partial<BailHandler_Options>): any;
export declare class RenderResultSpan {
    bailMessage: string | n;
    accessorInfo: string | n;
    startTime: number;
    endTime?: number;
    duration?: number;
}
export declare class MGLCompMeta {
    timeOfFirstRenderAttempt?: number;
    timeOfFirstRenderSuccess?: number;
    renderResultSpans: RenderResultSpan[];
    NotifyRenderStart(): void;
    NotifyRenderCompletion(): void;
    NotifyBailError(ex: BailError): void;
    NotifyRenderResult(bailMessage: string | null): void;
}
export declare class ObserverMGL_Options {
    graphlink: Graphlink<any, any> | n;
    bailHandler: boolean;
    bailHandler_opts?: Partial<BailHandler_Options>;
    observer: boolean;
}
/** Variant of mobx-react's `observer` function (for comp-classes), which also adds bail-handling behavior. */
export declare function ObserverMGL(targetClass: Function): any;
export declare function ObserverMGL(options: Partial<ObserverMGL_Options> | n): any;
/** Variant of mobx-react's `observer` function (for render-funcs), which also adds bail-handling behavior. */
export declare function observer_mgl<T>(func: React.FC<T>): React.FC<T>;
export declare function observer_mgl<T>(options: Partial<ObserverMGL_Options> | n, func: React.FC<T>): React.FC<T>;
export declare function GetInnermostRenderFunc(renderFunc: React.FunctionComponent): React.FunctionComponent;
export declare const mglClasses: Function[];
export declare function GetMGLClass(name: string): Function | undefined;
export declare function MGLClass(opts?: {
    name?: string;
    table?: string;
    schemaDeps?: string[];
}, schemaExtrasOrGetter?: Object | (() => Object)): (constructor: Function) => void;
export type Field_Extras = {
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
