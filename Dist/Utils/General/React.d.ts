import React from "react";
export declare let hookUpdatesBlocked: boolean;
export declare function SetHookUpdatesBlocked(blocked: boolean): void;
export declare class HookCallRecorder {
    hookCalls: {
        hookFunc: string;
        args: any[];
    }[];
}
export declare const hookCallRecorders: Set<HookCallRecorder>;
export declare const useState_orig: typeof React.useState;
export declare const React_origHookFuncs: {};
