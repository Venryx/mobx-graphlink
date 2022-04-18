export declare enum DataStatus {
    Initial = "Initial",
    /** Not sure if this actually gets utilized atm. (it relates to apollo's caching-layer) */
    Received_CachedByApollo = "Received_CachedByApollo",
    /** Something gets "cached by mobx-graphlink" if its status was Received_Live, but then it's unsubscribed from. (meant for instant result-returning when resubscribing later) */
    Received_CachedByMGL = "Received_CachedByMGL",
    Received_Live = "Received_Live"
}
export declare function GetPreferenceLevelOfDataStatus(status: DataStatus): 0 | 1 | 2 | 3 | 4;
export declare class TreeNodeData<DataShape> {
    constructor();
    status: DataStatus;
    data: DataShape;
    /** Whenever `data` is set, this field is updated to be a stringified version of the data. */
    dataJSON: string;
    NotifySubscriptionDropped(): void;
    IsDataAcceptableToConsume(): boolean;
    SetData(data: DataShape, fromCache: boolean): boolean;
    UpdateStatusAfterDataChange(dataChanged: boolean, fromCache: boolean): void;
}
