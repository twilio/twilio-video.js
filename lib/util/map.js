'use strict';

/**
 * Add a value to the Set at the given key. If a Set does not already exist
 * at the given key, create one.
 * @param {Map<*, Set<*>>} map
 * @param {*} key
 * @param {*} value
 * @returns {Map<*, Set<*>>}
 */
function addToMapOfSets(map, key, value) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key).add(value);
  return map;
}

/**
 * Delete a value from the Set at the given key. If deleting the value results
 * in an empty Set, delete the Set from the Map.
 * @param {Map<*, Set<*>>} map
 * @param {*} key
 * @param {*} value
 * @returns {Map<*, Set<*>>}
 */
function deleteFromMapOfSets(map, key, value) {
  if (!map.has(key)) {
    return map;
  }
  var set = map.get(key);
  set.delete(value);
  if (!set.size) {
    map.delete(set);
  }
  return map;
}

module.exports.addToMapOfSets = addToMapOfSets;
module.exports.deleteFromMapOfSets = deleteFromMapOfSets;
