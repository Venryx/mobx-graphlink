import {Buffer} from "buffer";

import {v4, parse, stringify} from "uuid";
// must use this approach for some esm modules that end up importing this library/file (and must use "* as uuid" for use from, eg. dm's app-server-js)
/*import * as uuid from "uuid";
const {v4, parse, stringify} = uuid.default ?? uuid; // annoying workaround for inconsistent handling seen between dm's "db.buildSeedDBScript" script, and the app-server-js program/pod*/
/*import {createRequire} from "module";
const require = createRequire(import.meta.url);
const {v4, parse, stringify} = require("uuid");*/

// Wrapper around "uuid" library, for "compacting" UUIDs into 22-character strings, of the char-set "[a-zA-Z0-9_-]".
// Based on: https://github.com/taskcluster/slugid

/**
 * Returns the given uuid as a 22 character slug. This can be a regular v4
 * slug or a "nice" slug.
 */
export function slugid_encode(uuid_: string) {
  var bytes = parse(uuid_);
  var base64 = Buffer.from(bytes).toString("base64");
  var slug = base64
              .replace(/\+/g, "-")  // Replace + with - (see RFC 4648, sec. 5)
              .replace(/\//g, "_")  // Replace / with _ (see RFC 4648, sec. 5)
              .substring(0, 22);    // Drop "==" padding
  return slug;
};

/** Returns the uuid represented by the given v4 or "nice" slug */
export function slugid_decode(slug: string) {
  var base64 = slug
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		+ "==";
  return stringify(Buffer.from(base64, "base64"));
};

/** Returns a randomly generated uuid v4 compliant slug */
export function slugid_v4() {
  var bytes = v4(null, Buffer.alloc(16));
  var base64 = bytes.toString("base64");
  var slug = base64
		.replace(/\+/g, "-")  // Replace + with - (see RFC 4648, sec. 5)
		.replace(/\//g, "_")  // Replace / with _ (see RFC 4648, sec. 5)
		.substring(0, 22);    // Drop "==" padding
  return slug;
};

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
export function slugid_nice() {
  var bytes = v4(null, Buffer.alloc(16));
  bytes[0] = bytes[0] & 0x7f;  // unset first bit to ensure [A-Za-f] first char
  var base64 = bytes.toString("base64");
  var slug = base64
		.replace(/\+/g, "-")  // Replace + with - (see RFC 4648, sec. 5)
		.replace(/\//g, "_")  // Replace / with _ (see RFC 4648, sec. 5)
		.substring(0, 22);    // Drop "==" padding
  return slug;
};