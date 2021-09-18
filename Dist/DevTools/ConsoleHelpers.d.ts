import { AccessorMetadata } from "../Accessors/@AccessorMetadata.js";
export declare function GetAccessorMetadatas(): AccessorMetadata[];
export declare function LogAccessorMetadatas(): void;
export declare function GetAccessorRunInfos(): ({
    name: string;
} & Pick<AccessorMetadata, "callCount" | "totalRunTime"> & {
    callPlansStored: number;
    rest: AccessorMetadata;
})[];
export declare function LogAccessorRunInfos(): void;
