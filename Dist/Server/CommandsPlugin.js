var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
//import {makeExtendSchemaPlugin, gql} from "graphile-utils";
import graphileUtils from "graphile-utils";
import { Assert, CE } from "js-vextensions";
import { WithBrackets } from "../Tree/QueryParams.js";
import { GetCommandClassMetadatas } from "./CommandMetadata.js";
const { makeExtendSchemaPlugin, gql } = graphileUtils;
function GQL_BetterErrorHandling(str) {
    try {
        return gql `${str}`;
    }
    catch (ex) {
        console.log("GQL error hit for str:", str);
        throw ex;
    }
}
class CommandRunInfo {
}
;
class CreateCommandPlugin_Options {
}
export const CreateCommandsPlugin = (opts) => {
    return makeExtendSchemaPlugin(build => {
        const commandClassMetas = GetCommandClassMetadatas();
        const allNewTypeDefs_strings = [];
        for (const meta of commandClassMetas) {
            // type-defs (used by mutation-resolver type)
            for (const typeDef of meta.payload_typeDefs) {
                allNewTypeDefs_strings.push(typeDef.str);
            }
            for (const typeDef of meta.return_typeDefs) {
                allNewTypeDefs_strings.push(typeDef.str);
            }
            const returnGQLTypeName = meta.FindGQLTypeName({ group: "return", typeName: `${meta.commandClass.name}_ReturnData` });
            // output example: "UpdateTerm(id: ID!, updates: UpdateTermT0UpdatesT0): UpdateTerm_ReturnT0"
            allNewTypeDefs_strings.push(`
	extend type Mutation {
		${meta.commandClass.name}${WithBrackets(meta.Args_GetArgDefsStr())}: ${returnGQLTypeName}
	}
			`);
        }
        const mutationResolvers = CE(commandClassMetas).ToMapObj(meta => meta.commandClass.name, classInfo => {
            return (parent, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
                /*const { rows } = await context.pgClient.query(
                    sqlText, // e.g. "select * from users where id = $1"
                    optionalVariables // e.g. [27]
                );*/
                var _a, _b;
                //context.pgClient.query()
                const CommandClass = classInfo.commandClass;
                const command = new CommandClass(args);
                Assert(context.req.user != null, "Cannot run command on server unless logged in.");
                command._userInfo_override = context.req.user;
                command._userInfo_override_set = true;
                (_a = opts.preCommandRun) === null || _a === void 0 ? void 0 : _a.call(opts, { parent, args, context, info, command });
                let returnData;
                let error;
                try {
                    returnData = yield command.RunLocally();
                }
                catch (ex) {
                    error = ex;
                    throw ex;
                }
                finally {
                    (_b = opts.postCommandRun) === null || _b === void 0 ? void 0 : _b.call(opts, { parent, args, context, info, command, returnData, error });
                }
                return returnData;
            });
        });
        const allNewTypeDefs = allNewTypeDefs_strings.map(str => {
            // if type-def string is empty, add a placeholder field (to avoid graphql error)
            if (!str.includes("{")) {
                str += " { _: Boolean }";
            }
            return GQL_BetterErrorHandling(str);
        });
        //console.log("CommandsPlugin init done. @typeDefs:\n==========\n", allNewTypeDefs_strings.join("\n\n"), "\n==========\n@mutationResolvers:", mutationResolvers);
        return {
            typeDefs: allNewTypeDefs,
            resolvers: {
                Mutation: mutationResolvers,
            },
        };
    });
};
