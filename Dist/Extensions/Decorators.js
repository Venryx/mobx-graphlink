import { Assert, CE, E } from "js-vextensions";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { reaction } from "mobx";
import { observer } from "mobx-react";
import { AddSchema, collection_docSchemaName } from "./JSONSchemaHelpers.js";
import { BailError } from "../Utils/General/BailManager.js";
import { HookCallRecorder, hookCallRecorders, hookUpdatesBlocked, SetHookUpdatesBlocked } from "../index.js";
// metadata-retrieval helpers
// ==========
export function TableNameToDocSchemaName(tableName, errorIfMissing = true) {
    //if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
    const docSchemaName = collection_docSchemaName.get(tableName);
    if (errorIfMissing)
        Assert(docSchemaName, `No schema has been associated with collection "${tableName}". Did you forget the \`@MGLClass({table: "tableName"})\` decorator?`);
    return docSchemaName;
}
export function TableNameToGraphQLDocRetrieverKey(tableName) {
    //return ModifyString(this.DocSchemaName, m=>[m.startUpper_to_lower, m.underscoreUpper_to_underscoreLower]);
    return tableName.replace(/ies$/, "y").replace(/s$/, "");
}
// ui stuff
// ==========
export let BailHandler_loadingUI_default = () => null;
export function BailHandler_loadingUI_default_Set(value) {
    BailHandler_loadingUI_default = value;
}
export class BailHandler_Options {
    constructor() {
        this.storeMetadata = true;
    }
}
export function BailHandler(...args) {
    let opts = new BailHandler_Options();
    if (typeof args[0] == "function") {
        ApplyToClass(args[0]);
    }
    else {
        opts = E(opts, args[0]);
        return ApplyToClass;
    }
    function ApplyToClass(targetClass) {
        const render_old = targetClass.prototype.render;
        targetClass.prototype.render = function (...args_inner) {
            var _a;
            if (opts.storeMetadata && this["mgl"] == null)
                this["mgl"] = new MGLCompMeta();
            const mgl = this["mgl"];
            // strategy 1: throw error (doesn't work in react 19 / with actual hooks in-use)
            /*try {
                if (mgl) mgl.NotifyRenderStart();
                const result = render_old.apply(this, args_inner);

                if (mgl) mgl.NotifyRenderCompletion();
                return result;
            } catch (ex) {
                if (ex instanceof BailError) {
                    if (mgl) mgl.NotifyBailError(ex);

                    const loadingUI = this.loadingUI ?? targetClass.prototype.loadingUI ?? opts.loadingUI ?? BailHandler_loadingUI_default;
                    return loadingUI.call(this, {comp: this, bailMessage: ex}); // current v-pref is to have loading-uis not care about the "this" passed, but kept same for now (doesn't hurt anything)
                }
                throw ex;
            }*/
            // strategy 2: throw error, but make it look like a promise rejection (while also wrapping render func's return in a Suspense)
            const loadingUI_final = (_a = opts.loadingUI) !== null && _a !== void 0 ? _a : BailHandler_loadingUI_default;
            let stashedBailError;
            const loadingUI_final_asFuncComp = () => {
                return loadingUI_final({ comp: this, bailMessage: stashedBailError });
            };
            const func_withBailConvertedToThrownPromise = () => {
                try {
                    if (mgl)
                        mgl.NotifyRenderStart();
                    const result = render_old.apply(this, args_inner);
                    if (mgl)
                        mgl.NotifyRenderCompletion();
                    return result;
                }
                catch (ex) {
                    if (ex instanceof BailError) {
                        if (mgl)
                            mgl.NotifyBailError(ex);
                        stashedBailError = ex;
                        ex["then"] = () => { }; // make react think this is a react suspense-error
                        throw ex;
                    }
                    else {
                        stashedBailError = null;
                    }
                    throw ex;
                }
            };
            return React.createElement(Suspense, { fallback: React.createElement(loadingUI_final_asFuncComp) }, func_withBailConvertedToThrownPromise());
            // TODO: Maybe update this class-based version to also have the <func_withBailConvertedToThrownPromise> as a child-comp, rather than a func we just call directly (so our new Suspense can wrap it).
            // (The complication is that doing so would make the original render-func have to be called with an unclear "this" object; using the wrapper-instance would be conceptually confusing, and constructing a fake instance would also be confusing.)
            // (The other complication is that it would sorta require BailHandler to be merged with ObserverMGL, since the observer would need to be applied to the new child-comp, rather than the original render-func.)
            // EDIT: For now, I'm just going to leave this as-is; while it doesn't catch bail-errors at the ideal granularity, it at least doesn't error out on react 19. (which is good enough since I'll be moving to func-comps everywhere anyway)
        };
    }
}
export class RenderResultSpan {
}
export class MGLCompMeta {
    constructor() {
        this.renderResultSpans = [];
        // to be called from dev-tools console (eg: `$r.mtg.BailDurations()`)
        //BailDurations() {}
    }
    NotifyRenderStart() {
        var _a;
        this.timeOfFirstRenderAttempt = (_a = this.timeOfFirstRenderAttempt) !== null && _a !== void 0 ? _a : Date.now();
    }
    NotifyRenderCompletion() {
        var _a;
        this.timeOfFirstRenderSuccess = (_a = this.timeOfFirstRenderSuccess) !== null && _a !== void 0 ? _a : Date.now();
        this.NotifyRenderResult(null);
    }
    NotifyBailError(ex) {
        this.NotifyRenderResult(ex.message);
    }
    NotifyRenderResult(bailMessage) {
        const lastResultSpan = CE(this.renderResultSpans).LastOrX();
        if (bailMessage != (lastResultSpan === null || lastResultSpan === void 0 ? void 0 : lastResultSpan.bailMessage)) {
            const now = Date.now();
            if (lastResultSpan != null) {
                lastResultSpan.endTime = now;
                lastResultSpan.duration = now - lastResultSpan.startTime;
            }
            let accessorInfo = null;
            if (bailMessage && bailMessage.includes("@accessor:")) {
                accessorInfo = bailMessage.split("@accessor:")[1]
                    .replace(/\(0,[a-zA-Z0-9_]+?\.GetDocs\)/g, "GetDocs")
                    .replace(/\(0,[a-zA-Z0-9_]+?\.GetDoc\)/g, "GetDoc");
            }
            this.renderResultSpans.push({
                bailMessage,
                accessorInfo,
                startTime: now,
            });
        }
    }
}
export class ObserverMGL_Options {
    constructor() {
        this.bailHandler = true;
        this.observer = true;
    }
}
export function ObserverMGL(...args) {
    let opts = new ObserverMGL_Options();
    if (typeof args[0] == "function") {
        ApplyToClass(args[0]);
    }
    else {
        opts = E(opts, args[0]);
        return ApplyToClass;
    }
    function ApplyToClass(targetClass) {
        if (opts.bailHandler)
            BailHandler(opts.bailHandler_opts)(targetClass);
        if (opts.observer)
            observer(targetClass);
    }
}
export function observer_mgl(...args) {
    let opts = new ObserverMGL_Options();
    let func;
    if (args[1] == null) {
        func = args[0];
    }
    else {
        opts = E(opts, args[0]);
        func = args[1];
    }
    let wrapperFunc;
    if (opts.bailHandler) {
        wrapperFunc = props => {
            var _a, _b;
            const loadingUI_final = (_b = (_a = opts.bailHandler_opts) === null || _a === void 0 ? void 0 : _a.loadingUI) !== null && _b !== void 0 ? _b : BailHandler_loadingUI_default;
            const [suspenseKickBacks, setSuspenseKickBacks] = useState(0);
            return React.createElement(Suspense, {
                fallback: React.createElement(LoadingUIProxy, {
                    key: `suspense_${suspenseKickBacks}`, // change key each time; this is how we avoid the react "hook order changed" warning
                    normalComp: func, // redundantly attached as prop here, just for easier discovery in react dev-tools
                    normalCompProps: props,
                    loadingUI: loadingUI_final,
                    kickBack: () => setSuspenseKickBacks(suspenseKickBacks + 1),
                }),
            }, React.createElement(NormalCompProxy, {
                key: `normalComp_${suspenseKickBacks}`,
                normalComp: func,
                normalCompProps: props,
            }));
        };
    }
    else {
        wrapperFunc = observer(func);
    }
    wrapperFunc["innerRenderFunc"] = func;
    return wrapperFunc;
}
export function GetInnermostRenderFunc(renderFunc) {
    let result = renderFunc;
    while (result["innerRenderFunc"]) {
        result = result["innerRenderFunc"];
    }
    return result;
}
const NormalCompProxy = observer((props) => {
    const { normalComp, normalCompProps } = props;
    const normalComp_innermostRenderFunc = GetInnermostRenderFunc(normalComp);
    try {
        return normalComp_innermostRenderFunc(normalCompProps);
    }
    catch (ex) {
        if (ex instanceof BailError) {
            ex["then"] = () => { }; // make react think this is a react suspense-error (no need to call this callback; rerender will happen when mobx-reactive fallback comp calls kickBack())
            throw ex;
        }
        throw ex;
    }
});
const LoadingUIProxy = (props) => {
    console.log("Test1___0");
    const { normalComp, normalCompProps, loadingUI, kickBack } = props;
    const normalComp_innermostRenderFunc = GetInnermostRenderFunc(normalComp);
    const self = useMemo(() => ({
        reactionTrackerTriggers: 0,
        firstRender_hookCallRecorder: new HookCallRecorder(),
        stashedBailError: null,
        reactionDisposer: null,
        kickBackDone: false,
        kickBack_oneTime: () => {
            if (self.kickBackDone)
                return;
            self.kickBackDone = true;
            self.reactionDisposer();
            kickBack();
        },
    }), []);
    if (self.reactionDisposer == null) {
        self.reactionDisposer = reaction(() => {
            if (self.reactionTrackerTriggers > 0)
                return {}; // return new object, so reaction-half triggers any time this tracker-half reruns
            self.reactionTrackerTriggers++;
            let hitError = false;
            const hookUpdatesBlocked_old = hookUpdatesBlocked;
            SetHookUpdatesBlocked(true); // needed, else normalComp_innermostRenderFunc may call the set-val func of a useState, which would cause the "hook order changed" warning when this LoadingUIProxy re-renders unnecessarily!
            hookCallRecorders.add(self.firstRender_hookCallRecorder); // if we're here, we're in the first render (since the `return {}` above exits this reaction early for subsequent renders/triggers)
            try {
                normalComp_innermostRenderFunc(normalCompProps);
                // if we didn't hit a bail-error, we can just immediately kick back to regular rendering!
                if (!hitError) {
                    setTimeout(() => self.kickBack_oneTime());
                }
            }
            catch (ex) {
                hitError = true;
                if (ex instanceof BailError) {
                    self.stashedBailError = ex; // ignore/simply-store bail-error during first render (we called `func` simply to subscribe to the same mobx accesses)
                }
                else {
                    //self.stashedBailError = ex;
                    throw ex;
                }
            }
            finally {
                SetHookUpdatesBlocked(hookUpdatesBlocked_old);
                hookCallRecorders.delete(self.firstRender_hookCallRecorder);
            }
            return {}; // return new object, so reaction-half triggers any time this tracker-half reruns
        }, 
        // whenever the mobx data accessed by normal-comp render-func (called independently above) changes, kick-back to normal-comp for react-rendering
        () => {
            self.kickBack_oneTime();
        });
    }
    else {
        // if reaction is already running, this is an "extraneous render" (caused by an unwanted update from the innermost render-func), which we have no need for
        // so just ensure kick-back has started, AND return a promise that never resolves (just to make sure we don't trigger the "hook order changed" warning)
        // (note: this technically works, but gives warning)
        /*self.kickBack_oneTime();
        return new Promise(()=>{});
        
        // note: as an alternative to returning a never-resolving promise, we maybe could instead call `normalComp_innermostRenderFunc(normalCompProps)` again; but the above seems cleaner*/
        /*const hookUpdatesBlocked_old = hookUpdatesBlocked;
        SetHookUpdatesBlocked(true); // needed, else normalComp_innermostRenderFunc may call the set-val func of a useState, which would cause the "hook order changed" warning when this LoadingUIProxy re-renders unnecessarily!
        normalComp_innermostRenderFunc(normalCompProps);
        SetHookUpdatesBlocked(hookUpdatesBlocked_old);*/
        for (const call of self.firstRender_hookCallRecorder.hookCalls) {
            console.log("Adding:", call);
            React[call.hookFunc].apply(null, call.args);
        }
    }
    useEffect(() => {
        return () => void (self.reactionDisposer());
    }, []);
    //return new Promise(()=>{});
    console.log("Test1_________________");
    return loadingUI({ comp: { name: "unknown", normalComp, normalCompProps }, bailMessage: self.stashedBailError });
};
/*function useIsFirstRender() {
    const isFirstRender = useRef(true);
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return true;
    }
    return false;
}*/
// db stuff
// ==========
/*export function Table(docSchemaName: string) {
    return ApplyToClass;
    function ApplyToClass<T>(targetClass: T, propertyKey: string) {
        collection_docSchemaName.set(propertyKey, docSchemaName);
    }
}*/
export const mglClasses = [];
export function GetMGLClass(name) {
    return mglClasses.find(a => a.name == name);
}
export function MGLClass(opts, schemaExtrasOrGetter) {
    return (constructor) => {
        var _a;
        Assert(!mglClasses.includes(constructor));
        mglClasses.push(constructor);
        const typeName = (_a = opts === null || opts === void 0 ? void 0 : opts.name) !== null && _a !== void 0 ? _a : constructor.name;
        const schemaDeps = opts === null || opts === void 0 ? void 0 : opts.schemaDeps;
        if (opts === null || opts === void 0 ? void 0 : opts.table) {
            collection_docSchemaName.set(opts.table, typeName);
            constructor["_table"] = opts.table;
        }
        AddSchema(typeName, schemaDeps, () => {
            var _a, _b, _c, _d;
            const schema = schemaExtrasOrGetter instanceof Function ? schemaExtrasOrGetter() : (schemaExtrasOrGetter !== null && schemaExtrasOrGetter !== void 0 ? schemaExtrasOrGetter : {});
            schema.properties = (_a = schema.properties) !== null && _a !== void 0 ? _a : {};
            for (const [key, fieldSchemaOrGetter] of Object.entries((_b = constructor["_fields"]) !== null && _b !== void 0 ? _b : [])) {
                let fieldSchema = fieldSchemaOrGetter instanceof Function ? fieldSchemaOrGetter() : fieldSchemaOrGetter;
                const extras = (_c = constructor["_fieldExtras"]) === null || _c === void 0 ? void 0 : _c[key];
                if (extras === null || extras === void 0 ? void 0 : extras.opt) {
                    const fieldSchemaKeys = Object.keys(fieldSchema);
                    if (fieldSchemaKeys.length == 1 && fieldSchemaKeys[0] == "type") {
                        const fieldTypes = (Array.isArray(fieldSchema.type) ? fieldSchema.type : [fieldSchema.type]);
                        const alreadyAcceptsNull = fieldTypes.includes("null");
                        if (!alreadyAcceptsNull) {
                            fieldSchema.type = fieldTypes.concat("null");
                        }
                    }
                    else {
                        fieldSchema = {
                            anyOf: [fieldSchema, { type: "null" }],
                        };
                    }
                }
                else {
                    schema.required = (_d = schema.required) !== null && _d !== void 0 ? _d : [];
                    schema.required.push(key);
                }
                schema.properties[key] = fieldSchema;
            }
            return schema;
        });
    };
}
/**
Marks the given field to be part of the json-schema for the current class.
Note that the "requiredness" of properties should be based on what's valid for an entry during submission to the database (ie. within the type's main AddXXX command);
    this is different than the TS "?" marker, which should match with the requiredness of the property when already in the db. (for new entries, the TS constructors already make all props optional)
*/
export function Field(schemaOrGetter, extras) {
    //return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
    return function (target, propertyKey) {
        var _a, _b;
        const constructor = target.constructor;
        constructor["_fields"] = (_a = constructor["_fields"]) !== null && _a !== void 0 ? _a : {};
        constructor["_fields"][propertyKey] = schemaOrGetter;
        if (extras) {
            constructor["_fieldExtras"] = (_b = constructor["_fieldExtras"]) !== null && _b !== void 0 ? _b : {};
            constructor["_fieldExtras"][propertyKey] = extras;
        }
    };
}
