import {g} from "./Utils/@PrivateExports.js";

// warn about multiple lib instances
let vLibCounts = (g["vLibCounts"] = g["vLibCounts"] || {});
vLibCounts["mobx-graphlink"] = (vLibCounts["mobx-graphlink"] || 0) + 1;
if (vLibCounts["mobx-graphlink"] >= 2) {
	console.warn("More than one instance of mobx-graphlink loaded. This can cause issues, eg. with WrapDBValue.");
}

// root
// ==========

export * from "./Graphlink.js"; // main

// subfolders
// ==========

export * from "./Accessors/CreateAccessor.js";
export * from "./Accessors/DBAccessors.js";
export * from "./Accessors/Helpers.js";

export * from "./DBShape/Constructs.js";

// these "extensions" are separable from mobx-graphlink, but are included for convenience, since I use them everywhere I use mobx-graphlink
export * from "./Extensions/KeyGenerator.js";
export * from "./Extensions/SchemaHelpers.js";
export * from "./Extensions/Decorators.js";

export * from "./Server/Command.js";

export * from "./Tree/TreeNode.js";

export * from "./Utils/BailManager.js";
export * from "./Utils/DatabaseHelpers.js";
export * from "./Utils/DBUpdateMerging.js";
export * from "./Utils/General.js";
export * from "./Utils/MobX.js";
export * from "./Utils/PathHelpers.js";
export * from "./Utils/StringSplitCache.js";
export * from "./Utils/TypeHelpers.js";