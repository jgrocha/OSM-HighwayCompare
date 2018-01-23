/**
 * Deep clone hack of a json object
 * @param json: object
 * @returns {json}
 */
exports.cloneJson = function(json){
    // Deep clone hack
    return JSON.parse(JSON.stringify(json));
};