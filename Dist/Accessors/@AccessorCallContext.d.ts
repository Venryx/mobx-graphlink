import { IComputedValue } from "mobx";
import { Graphlink } from "../index.js";
import { RootStoreShape } from "../UserTypes.js";
import { AccessorMetadata } from "./@AccessorMetadata.js";
export declare class AccessorCallContext {
    constructor(graph: Graphlink<RootStoreShape, any>, accessorMeta: AccessorMetadata, catchItemBails: boolean, catchItemBails_asX: any);
    graph: Graphlink<RootStoreShape, any>;
    accessorMeta: AccessorMetadata;
    catchItemBails: boolean;
    catchItemBails_asX: any;
    cachedResult: IComputedValue<any>;
    _lastCall_startTime?: number;
    get store(): RootStoreShape;
    MaybeCatchItemBail<T>(itemGetter: () => T): T;
}
