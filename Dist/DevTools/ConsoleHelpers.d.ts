import { AccessorMetadata, ProfilingInfo } from "../Accessors/@AccessorMetadata.js";
export declare function GetAccessorMetadatas(): AccessorMetadata[];
export declare function LogAccessorMetadatas(): void;
export declare function GetAccessorRunInfos(): ({
    name: string;
} & Omit<ProfilingInfo, "NotifyOfCall"> & {
    callPlansStored: number;
    rest: AccessorMetadata;
})[];
export declare function LogAccessorRunInfos(): void;
