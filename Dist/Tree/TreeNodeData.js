import { Assert, ObjectCE, ToJSON } from "js-vextensions";
import { observable } from "mobx";
import { CleanDBData } from "../Utils/DB/DBDataHelpers.js";
import { makeObservable_safe, RunInAction } from "../Utils/General/MobX.js";
export var DataStatus;
(function (DataStatus) {
    DataStatus["Initial"] = "Initial";
    /** Not sure if this actually gets utilized atm. (it relates to apollo's caching-layer) */
    DataStatus["Received_CachedByApollo"] = "Received_CachedByApollo";
    /** Something gets "cached by mobx-graphlink" if its status was Received_Live, but then it's unsubscribed from. (meant for instant result-returning when resubscribing later) */
    DataStatus["Received_CachedByMGL"] = "Received_CachedByMGL";
    DataStatus["Received_Live"] = "Received_Live";
})(DataStatus || (DataStatus = {}));
export function GetPreferenceLevelOfDataStatus(status) {
    switch (status) {
        case DataStatus.Initial: return 1;
        case DataStatus.Received_CachedByApollo: return 2;
        case DataStatus.Received_CachedByMGL: return 3;
        case DataStatus.Received_Live: return 4;
        default: {
            Assert(false, `Unknown DataStatus: ${status}`);
            return 0;
        }
    }
}
export class TreeNodeData {
    constructor() {
        this.status = DataStatus.Initial; // [@O]
        makeObservable_safe(this, {
            status: observable,
            data: observable.ref,
        });
    }
    NotifySubscriptionDropped(allowKeepDataCached = true) {
        RunInAction("TreeNodeData.NotifySubscriptionDropped", () => {
            // if we have a valid result, but are now unsubscribing, mark the data specially (so that it can be instantly returned when resubscribing)
            if (this.status == DataStatus.Received_Live && allowKeepDataCached) {
                this.status = DataStatus.Received_CachedByMGL;
            }
            else {
                this.status = DataStatus.Initial;
            }
        });
    }
    IsDataAcceptableToConsume() {
        return ObjectCE(this.status).IsOneOf(DataStatus.Received_Live, DataStatus.Received_CachedByMGL);
    }
    SetData(data, fromMemoryCache) {
        // this.data being "undefined" is used to signify that it's still loading; so if firebase-given value is "undefined", change it to "null"
        if (data === undefined) {
            data = null;
        }
        // Note: with `includeMetadataChanges` enabled, firestore refreshes all subscriptions every half-hour or so. (first with fromCache:true, then with fromCache:false)
        // The checks below are how we keep those refreshes from causing unnecesary subscription-listener triggers. (since that causes unnecessary cache-breaking and UI updating)
        // (if needed, we could just *delay* the update: after X time passes, check if there was a subsequent from-server update that supersedes it -- only propogating the update if there wasn't one)
        const dataJSON = ToJSON(data);
        const dataChanged = dataJSON != this.dataJSON;
        if (dataChanged) {
            //console.log("Data changed from:", this.data, " to:", data, " @node:", this);
            //data = data ? observable(data_raw) as any : null;
            // for graphql system, not currently needed
            CleanDBData(data); //, this.pathSegments);
            this.data = data;
            this.dataJSON = dataJSON;
        }
        this.UpdateStatusAfterDataChange(dataChanged, fromMemoryCache);
        return dataChanged;
    }
    UpdateStatusAfterDataChange(dataChanged, fromMemoryCache) {
        const newStatus = fromMemoryCache ? DataStatus.Received_CachedByApollo : DataStatus.Received_Live;
        const isIgnorableStatusChange = !dataChanged && newStatus == DataStatus.Received_CachedByApollo && this.status == DataStatus.Received_Live;
        if (newStatus != this.status && !isIgnorableStatusChange) {
            //if (data != null) {
            //ProcessDBData(this.data, true, true, CE(this.pathSegments).Last()); // also add to proxy (since the mobx proxy doesn't expose non-enumerable props) // maybe rework
            this.status = newStatus;
            /*} else {
                // entry was deleted; reset status to "initial"
                this.status = DataStatus.Initial;
            }*/
        }
    }
}
