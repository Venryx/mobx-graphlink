let splitCache_forwardSlash = {};
//export function SplitString_Cached(str: string, splitChar: string) {
export function SplitStringBySlash_Cached(str) {
    return splitCache_forwardSlash[str] || (splitCache_forwardSlash[str] = str.split("/"));
}
