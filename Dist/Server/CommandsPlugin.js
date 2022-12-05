import { Assert, CE, Clone } from "js-vextensions";
import { FinalizeSchemaForConversionToGraphQL, GetGQLSchemaInfoFromJSONSchema } from "../Extensions/GQLSchemaHelpers.js";
import { GetSchemaJSON, IsJSONSchemaOfTypeScalar, schemaEntryJSONs } from "../Extensions/JSONSchemaHelpers.js";
import { WithBrackets } from "../Tree/QueryParams.js";
import { GetCommandClassMetadatas } from "./CommandMetadata.js";
function GQL_BetterErrorHandling(str, gql) {
    try {
        return gql `${str}`;
    }
    catch (ex) {
        console.log("GQL error hit for str:", str);
        throw ex;
    }
}
export class CommandRunInfo {
}
;
export class CreateCommandPlugin_Options {
}
export let CommandsPlugin_opts;
export const CreateCommandsPlugin = (apis, opts) => {
    const { makeExtendSchemaPlugin, gql } = apis;
    CommandsPlugin_opts = opts;
    return makeExtendSchemaPlugin((build, schemaOptions) => {
        var _a;
        const commandClassMetas_all = GetCommandClassMetadatas();
        const commandClassMetas_graphQL = commandClassMetas_all.filter(a => a.exposeToGraphQL);
        const allNewTypeDefs = []; // used only for cleaner logging
        //const allNewTypeDefs_strings = [] as string[];
        // there are a few schemas that are referenced by the command-classes, but which are not "MGLClass main types" (and thus are not yet part of the graphql types); so add them here
        const schemaDeps = [];
        if (opts.schemaDeps_auto) {
            for (const [name, jsonSchema] of schemaEntryJSONs) {
                if ((_a = opts.schemaDeps_auto_exclude) === null || _a === void 0 ? void 0 : _a.includes(name))
                    continue;
                const jsonSchema_copy = Clone(jsonSchema);
                FinalizeSchemaForConversionToGraphQL(jsonSchema_copy);
                if (IsJSONSchemaOfTypeScalar(jsonSchema_copy))
                    continue; // graphql types can't represent scalars (eg. with constraints) as separate types; ignore these
                // if can't find schema already added to graphql, add it now
                const gqlSchemaMatch = build.getTypeByName(name);
                //console.log("@name:", name, "@match:", gqlSchemaMatch);
                if (gqlSchemaMatch == null) {
                    schemaDeps.push(name);
                }
            }
        }
        if (opts.schemaDeps) {
            schemaDeps.push(...opts.schemaDeps);
        }
        let startTime = Date.now();
        //console.log("SchemaDeps:", schemaDeps, "@start:", startTime);
        for (const dep of schemaDeps) {
            const depJSONSchema = GetSchemaJSON(dep);
            Assert(depJSONSchema, `Could not find schema-json for schema-dep "${dep}".`);
            const graphqlInfo = GetGQLSchemaInfoFromJSONSchema({ rootName: dep, jsonSchema: depJSONSchema, direction: "input" });
            /*const schemaStr_fixed = graphqlInfo.schemaAsStr.replace(new RegExp(`(\\W)${graphqlInfo.typeName}(\\W)`, "g"), (str, p1, p2)=>`${p1}${dep}${p2}`); // change type-name back to what it's supposed to be
            console.log("Test3:", graphqlInfo.typeName, "@str:", graphqlInfo.schemaAsStr, "@fixed:", schemaStr_fixed);
            allNewTypeDefs_strings.push(schemaStr_fixed);*/
            allNewTypeDefs.push(...graphqlInfo.typeDefs);
            //allNewTypeDefs_strings.push(graphqlInfo.schemaAsStr);
        }
        console.log("SchemaDeps_DoneAfter:", Date.now() - startTime);
        for (const meta of commandClassMetas_graphQL) {
            //const typeDefStringsForEntry = [] as string[];
            // merge schema-dep graph-ql-strings into first command's graph-ql-str (else errors, because each entry must have an "extent type Mutation { ... }" part)
            /*if (meta == commandClassMetas[0]) {
                typeDefStringsForEntry.push(...allNewTypeDefs_strings);
                allNewTypeDefs_strings.length = 0;
            }*/
            // type-defs (used by mutation-resolver type)
            for (const typeDef of meta.payload_graphqlInfo.typeDefs) {
                if (build.getTypeByName(typeDef.name)) {
                    console.log(`Type "${typeDef.name}" already found; not adding again.`);
                    continue;
                }
                allNewTypeDefs.push(typeDef);
                //typeDefStringsForEntry.push(typeDef.str);
            }
            for (const typeDef of meta.return_graphqlInfo.typeDefs) {
                if (build.getTypeByName(typeDef.name)) {
                    console.log(`Type "${typeDef.name}" already found; not adding again.`);
                    continue;
                }
                allNewTypeDefs.push(typeDef);
                //typeDefStringsForEntry.push(typeDef.str);
            }
            const returnGQLTypeName = meta.FindGQLTypeName({ group: "return", typeName: `${meta.commandClass.name}_ReturnData` });
            // output example: "UpdateTerm(id: ID!, updates: UpdateTermT0UpdatesT0): UpdateTerm_ReturnT0"
            //typeDefStringsForEntry.push(`
            allNewTypeDefs.push({ type: "rootTypeExtension", name: meta.commandClass.name, str: `
	extend type Mutation {
		${meta.commandClass.name}${WithBrackets(meta.Args_GetArgDefsStr())}: ${returnGQLTypeName}
	}
			` });
            //allNewTypeDefs_strings.push(...typeDefStringsForEntry);
            //allNewTypeDefs_strings.push(typeDefStringsForEntry.join("\n\n")); // postgraphile is picky (bundle types with mutation-type-extension, because each entry must have a mutation-type-extension)
        }
        const mutationResolvers = CE(commandClassMetas_graphQL).ToMapObj(meta => meta.commandClass.name, classInfo => {
            return async (parent, args, context, info) => {
                /*const { rows } = await context.pgClient.query(
                    sqlText, // e.g. "select * from users where id = $1"
                    optionalVariables // e.g. [27]
                );*/
                var _a, _b;
                //context.pgClient.query()
                const CommandClass = classInfo.commandClass;
                const command = new CommandClass(args);
                //Assert(context.req.user != null, "Cannot run command on server unless logged in.");
                command._userInfo_override = context.req.user; // whether signed-in or not, set user-info override (if sign-in required, preCommandRun should generally reject the request)
                //command._userInfo_override_set = true;
                //console.log(`@Command:${CommandClass.name} UserInfo:`, context.req.user);
                await ((_a = opts.preCommandRun) === null || _a === void 0 ? void 0 : _a.call(opts, { parent, args, context, info, command }));
                let returnData;
                let dbUpdates;
                let error;
                try {
                    ({ returnData, dbUpdates } = await command.RunLocally());
                }
                catch (ex) {
                    error = ex;
                    throw ex;
                }
                finally {
                    command._userInfo_override = null; // defensive; will cause command.userInfo to error if called outside of code-block above
                    await ((_b = opts.postCommandRun) === null || _b === void 0 ? void 0 : _b.call(opts, { parent, args, context, info, command, returnData, dbUpdates, error }));
                }
                return returnData;
            };
        });
        if (opts.typeDefFinalizer) {
            for (const [i, typeDef] of allNewTypeDefs.entries()) {
                allNewTypeDefs[i] = opts.typeDefFinalizer(typeDef);
            }
        }
        const typeDefsBufferedForStringifying = [];
        const typeDefGroupStrings = [];
        for (const [i, typeDef] of allNewTypeDefs.entries()) {
            if (typeDef.type != "rootTypeExtension") {
                typeDefsBufferedForStringifying.push(typeDef);
                continue;
            }
            const parts = [...typeDefsBufferedForStringifying.map(a => a.str), typeDef.str];
            typeDefsBufferedForStringifying.length = 0;
            const parts_finalized = parts.map(part => {
                // if type-def string is empty, add a placeholder field (to avoid graphql error)
                if (!part.includes("{")) {
                    part += " { _: Boolean }";
                }
                return part;
            });
            let groupStr = parts_finalized.join("\n\n");
            if (opts.typeDefStrFinalizer)
                groupStr = opts.typeDefStrFinalizer(groupStr);
            typeDefGroupStrings.push(groupStr);
        }
        const typeDefGroups_gql = typeDefGroupStrings.map(str => GQL_BetterErrorHandling(str, gql));
        if (opts.logTypeDefs) {
            console.log("CommandsPlugin init done.", 
            //"@typeDefGroups:\n==========\n", typeDefGroupStrings.join("\n\n"),
            "@typeDefs:\n==========\n", allNewTypeDefs.map(typeDef => {
                let result = "";
                result += (typeDef.name + (typeDef.type == "rootTypeExtension" ? "(...)" : "") + ":   ").padEnd(70, " ");
                result += typeDef.str.replace(/\n/g, " ").replace(/\s+/g, " ").trimStart().slice(0, 200);
                return result;
            }).join("\n"), "\n==========\n@mutationResolvers:", mutationResolvers);
        }
        return {
            typeDefs: typeDefGroups_gql,
            resolvers: {
                Mutation: mutationResolvers,
            },
        };
    });
};
