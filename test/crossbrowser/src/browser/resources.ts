/**
 * Resource identifier (32 chars).
 * @typedef {string} ResourceID
 */
export type ResourceID = string;

/**
 * Resource collection type definition.
 */
interface Resources {
  lookup: Map<ResourceID, any>;
  reverseLookup: WeakMap<any, ResourceID>;
}

/**
 * Resource collection.
 * @type {Resources}
 */
const resources: Resources = {
  lookup: new Map(),
  reverseLookup: new WeakMap()
};

/**
 * Create a random {@link ResourceID}.
 * @private
 * @returns {ResourceID}
 */
function createResourceId(): string {
  return Math.random().toString().slice(2);
}

/**
 * Add a resource.
 * @param {*} resource
 * @returns {void}
 */
export function add(resource: any): void {
  const { lookup, reverseLookup } = resources;
  if (reverseLookup.has(resource)) {
    return;
  }

  const resourceId = createResourceId();
  lookup.set(resourceId, resource);
  reverseLookup.set(resource, resourceId);
}

/**
 * Look up a resource based on a {@link ResourceID}.
 * @param {ResourceID} resourceId
 * @returns {*}
 */
export function lookup(resourceId: ResourceID): any {
  const { lookup } = resources;
  return lookup.get(resourceId) || null;
}

/**
 * Remove a resource.
 * @param {*} resource
 * @returns {void}
 */
export function remove(resource: any): void {
  const { lookup, reverseLookup } = resources;
  if (!reverseLookup.has(resource)) {
    return;
  }

  const resourceId = reverseLookup.get(resource);
  reverseLookup.delete(resource);
  lookup.delete(resourceId);
}

/**
 * Look up a {@link ResourceID} based on a resource.
 * @param {*} resource
 * @returns {?ResourceID}
 */
export function reverseLookup(resource: any): ResourceID | null {
  const { reverseLookup } = resources;
  return reverseLookup.get(resource) || null;
}
