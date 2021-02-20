// warn about multiple lib instances
let vLibCounts = (window["vLibCounts"] = window["vLibCounts"] || {});
vLibCounts["mobx-graphlink"] = (vLibCounts["mobx-graphlink"] || 0) + 1;
if (vLibCounts["mobx-graphlink"] >= 2) {
    console.warn("More than one instance of mobx-graphlink loaded. This can cause issues, eg. with WrapDBValue.");
}
// root
// ==========
export * from "./Graphlink"; // main
// subfolders
// ==========
export * from "./Accessors/Custom";
export * from "./Accessors/Generic";
export * from "./Accessors/Helpers";
export * from "./DBShape/Constructs";
// these "extensions" are separable from mobx-graphlink, but are included for convenience, since I use them everywhere I use mobx-graphlink
export * from "./Extensions/KeyGenerator";
export * from "./Extensions/SchemaHelpers";
//export * from "./Server/Command";
export * from "./Tree/TreeNode";
//export * from "./Utils/DatabaseHelpers";
//export * from "./Utils/DBUpdateMerging";
export * from "./Utils/General";
export * from "./Utils/PathHelpers";
export * from "./Utils/StringSplitCache";
