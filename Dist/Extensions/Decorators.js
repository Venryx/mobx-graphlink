import { Assert, CE, E } from "js-vextensions";
import { AddSchema, collection_docSchemaName } from "./JSONSchemaHelpers.js";
import { BailError } from "../Utils/General/BailManager.js";
// metadata-retrieval helpers
// ==========
export function TableNameToDocSchemaName(tableName, errorIfMissing = true) {
    //if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
    const docSchemaName = collection_docSchemaName.get(tableName);
    if (errorIfMissing)
        Assert(docSchemaName, `No schema has been associated with collection "${tableName}". Did you forget the \`@Table("DOC_SCHEMA_NAME")\` decorator?`);
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
        targetClass.prototype.render = function (...args) {
            var _a, _b, _c;
            if (opts.storeMetadata && this["mgl"] == null)
                this["mgl"] = new MGLCompMeta();
            const mgl = this["mgl"];
            try {
                if (mgl)
                    mgl.NotifyRenderStart();
                const result = render_old.apply(this, args);
                if (mgl)
                    mgl.NotifyRenderCompletion();
                return result;
            }
            catch (ex) {
                if (ex instanceof BailError) {
                    if (mgl)
                        mgl.NotifyBailError(ex);
                    const loadingUI = (_c = (_b = (_a = this.loadingUI) !== null && _a !== void 0 ? _a : targetClass.prototype.loadingUI) !== null && _b !== void 0 ? _b : opts.loadingUI) !== null && _c !== void 0 ? _c : BailHandler_loadingUI_default;
                    return loadingUI.call(this, { comp: this, bailMessage: ex }); // current v-pref is to have loading-uis not care about the "this" passed, but kept same for now (doesn't hurt anything)
                }
                throw ex;
            }
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
let observer;
function WP_ImportSync(name_ending) {
    // Try to dynamically lazy import. Use import() to hint webpack we want to code split this module, but the "real" import needs to be synchronous.
    //import(`@/data/posts/${this.props.matches.slug}`);
    //require(...) doesn't work
    //return __webpack_require__(require.resolve(name));
    const moduleID = Object.keys(__webpack_require__.m).find(a => a.endsWith(name_ending));
    return __webpack_require__(moduleID);
}
function EnsureImported_MobXReact() {
    // if in NodeJS, return an empty decorator (NodeJS doesn't provide __webpack_require__ func, and lib should be NodeJS-safe at parse-time; fine since NodeJS/server won't actually use these observers)
    if (typeof window == "undefined" || typeof document == "undefined") {
        observer = function PlaceholderForNodeJS() { };
    }
    //observer = observer ?? (await import("mobx-react")).observer;
    //observer = observer ?? WP_ImportSync("mobx-react").observer;
    observer = observer !== null && observer !== void 0 ? observer : WP_ImportSync("/mobx-react/dist/mobxreact.esm.js").observer;
}
export class ObserverMGL_Options {
    constructor() {
        this.bailHandler = true;
    }
}
export function ObserverMGL(...args) {
    EnsureImported_MobXReact();
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
        observer(targetClass);
    }
}
export function observer_mgl(...args) {
    EnsureImported_MobXReact();
    let opts = new ObserverMGL_Options();
    let func;
    if (args[1] == null) {
        func = args[0];
    }
    else {
        opts = E(opts, args[0]);
        func = args[1];
    }
    if (opts.bailHandler) {
        return observer(props => {
            var _a, _b;
            try {
                return func(props);
            }
            catch (ex) {
                if (ex instanceof BailError) {
                    const loadingUI_final = (_b = (_a = opts.bailHandler_opts) === null || _a === void 0 ? void 0 : _a.loadingUI) !== null && _b !== void 0 ? _b : BailHandler_loadingUI_default;
                    return loadingUI_final({ comp: { name: "unknown", props }, bailMessage: ex });
                }
                throw ex;
            }
        });
    }
    return observer(func);
}
// db stuff
// ==========
/*export function Table(docSchemaName: string) {
    return ApplyToClass;
    function ApplyToClass<T>(targetClass: T, propertyKey: string) {
        collection_docSchemaName.set(propertyKey, docSchemaName);
    }
}*/
export const mglClasses = new Array();
export function GetMGLClass(name) {
    return mglClasses.find(a => a.name == name);
}
export function MGLClass(opts, schemaExtrasOrGetter, initFunc_pre) {
    return (constructor) => {
        var _a;
        Assert(!mglClasses.includes(constructor));
        mglClasses.push(constructor);
        const typeName = (_a = opts === null || opts === void 0 ? void 0 : opts.name) !== null && _a !== void 0 ? _a : constructor.name;
        const schemaDeps = opts === null || opts === void 0 ? void 0 : opts.schemaDeps;
        if (opts === null || opts === void 0 ? void 0 : opts.table) {
            collection_docSchemaName.set(opts.table, typeName);
            constructor["_table"] = opts.table;
            if (initFunc_pre)
                constructor["_initFunc_pre"] = initFunc_pre;
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
/**
Marks the given field to be a database column for the current class. (ie. in its generated table definition)
Note that "notNullable()" is called for these fields automatically; if you want it to be optional/nullable within the db, add ".nullable()" to the chain.
*/
export function DB(initFunc) {
    //return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
    return function (target, propertyKey) {
        var _a;
        const constructor = target.constructor;
        constructor["_fieldDBInits"] = (_a = constructor["_fieldDBInits"]) !== null && _a !== void 0 ? _a : {};
        constructor["_fieldDBInits"][propertyKey] = initFunc;
    };
}
export function GetFieldDBInit(constructor, fieldName) {
    var _a;
    return ((_a = constructor["_fieldDBInits"]) !== null && _a !== void 0 ? _a : {})[fieldName];
}
