/**
 * Returns the given uuid as a 22 character slug. This can be a regular v4
 * slug or a "nice" slug.
 */
export declare function slugid_encode(uuid_: string): string;
/** Returns the uuid represented by the given v4 or "nice" slug */
export declare function slugid_decode(slug: string): any;
/** Returns a randomly generated uuid v4 compliant slug */
export declare function slugid_v4(): any;
/**
 * Returns a randomly generated uuid v4 compliant slug which conforms to a set
 * of "nice" properties, at the cost of some entropy. Currently this means one
 * extra fixed bit (the first bit of the uuid is set to 0) which guarantees the
 * slug will begin with [A-Za-f]. For example such slugs don"t require special
 * handling when used as command line parameters (whereas non-nice slugs may
 * start with `-` which can confuse command line tools).
 *
 * Potentially other "nice" properties may be added in future to further
 * restrict the range of potential uuids that may be generated.
 */
export declare function slugid_nice(): any;
