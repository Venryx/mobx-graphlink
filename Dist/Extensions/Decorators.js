var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AddSchema, collection_docSchemaName, WaitTillSchemaAdded } from "./SchemaHelpers.js";
/*export function Table(docSchemaName: string) {
    return ApplyToClass;
    function ApplyToClass<T>(targetClass: T, propertyKey: string) {
        collection_docSchemaName.set(propertyKey, docSchemaName);
    }
}*/
export function MGLClass(opts, schemaExtrasOrGetter, initFunc_pre) {
    return ((constructor) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const typeName = (_a = opts === null || opts === void 0 ? void 0 : opts.name) !== null && _a !== void 0 ? _a : constructor.name;
        const schemaDeps = opts === null || opts === void 0 ? void 0 : opts.schemaDeps;
        if (schemaDeps != null)
            yield Promise.all(schemaDeps.map(schemaName => WaitTillSchemaAdded(schemaName)));
        let schema = schemaExtrasOrGetter instanceof Function ? schemaExtrasOrGetter() : (schemaExtrasOrGetter !== null && schemaExtrasOrGetter !== void 0 ? schemaExtrasOrGetter : {});
        schema.properties = (_b = schema.properties) !== null && _b !== void 0 ? _b : {};
        for (const [key, fieldSchema] of Object.entries((_c = constructor["_fields"]) !== null && _c !== void 0 ? _c : [])) {
            schema.properties[key] = fieldSchema;
            const extras = (_d = constructor["_fieldExtras"]) === null || _d === void 0 ? void 0 : _d[key];
            if (extras === null || extras === void 0 ? void 0 : extras.required) {
                schema.required = (_e = schema.required) !== null && _e !== void 0 ? _e : [];
                schema.required.push(key);
            }
        }
        if (opts === null || opts === void 0 ? void 0 : opts.table) {
            collection_docSchemaName.set(opts.table, typeName);
            constructor["_table"] = opts.table;
            if (initFunc_pre)
                constructor["_initFunc_pre"] = initFunc_pre;
        }
        AddSchema(typeName, schemaDeps, schema);
    }));
}
export function Field(schemaOrGetter, extras) {
    //return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
    return function (target, propertyKey) {
        var _a, _b;
        target["_fields"] = (_a = target["_fields"]) !== null && _a !== void 0 ? _a : {};
        target["_fields"][propertyKey] = schemaOrGetter;
        if (extras) {
            target["_fieldExtras"] = (_b = target["_fields"]) !== null && _b !== void 0 ? _b : {};
            target["_fieldExtras"][propertyKey] = extras;
        }
    };
}
/*interface Object {
    DeferRef: (this: Knex.ColumnBuilder)=>Knex.ColumnBuilder;
}*/
/*declare module "knex" {
    namespace Knex {
        interface ColumnBuilder {
            DeferRef: (this: Knex.ColumnBuilder)=>Knex.ColumnBuilder;
        }
    }
}*/
export function DB(initFunc) {
    //return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
    return function (target, propertyKey) {
        var _a;
        target["_fieldDBInits"] = (_a = target["_fieldDBInits"]) !== null && _a !== void 0 ? _a : {};
        target["_fieldDBInits"][propertyKey] = initFunc;
    };
}
