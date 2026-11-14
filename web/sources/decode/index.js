import { validateDecodeCase } from "../../contracts/validate.js";

const defaultBase = new URL("../../assets/decode/data/", import.meta.url);

/** Load a case by filename stem and validate it with the shared v2 validator.
 * baseUrl is a directory URL; relative strings resolve against this module.
 * @type {import('../../contracts/decode.js').LoadDecodeCase}
 */
export async function loadDecodeCase(id, options = {}) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) {
    throw new TypeError("Invalid Decode case id: use letters, digits, underscores or hyphens");
  }
  const base = new URL(options.baseUrl ?? defaultBase, import.meta.url);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const url = new URL(`${id}.json`, base);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load Decode case ${id} (${response.status})`);
  let json;
  try {
    json = await response.json();
  } catch (cause) {
    throw new Error(`Invalid JSON for Decode case ${id}`, { cause });
  }
  const data = validateDecodeCase(json);
  if (data.id !== id) throw new TypeError(`Decode case id mismatch: requested ${id}, received ${data.id}`);
  return data;
}
