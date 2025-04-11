// just local place to define project-wide constants that aren't auto-exported to user project
// ==========

//export const g = typeof window != "undefined" ? window : global;
export const g = typeof globalThis != "undefined" ? globalThis : window;