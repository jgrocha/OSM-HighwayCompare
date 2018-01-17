/**
 * This module is a modified version of lineOverlap from the Turfjs library.
 * Url: https://github.com/Turfjs/turf/tree/master/packages/turf-line-overlap
 **/

var rbush = require('geojson-rbush');
var lineSegment = require('@turf/line-segment');
var nearestPointOnLine = require('@turf/nearest-point-on-line');
var booleanPointOnLine = require('@turf/boolean-point-on-line');
var inv = require('@turf/invariant');
var getCoords = inv.getCoords;
var meta = require('@turf/meta');
var featureEach = meta.featureEach;
var segmentEach = meta.segmentEach;

var helpers = require('@turf/helpers');
var featureCollection = helpers.featureCollection;
var isObject = helpers.isObject;

// var buff = require("@turf/buffer");
var bbox = require("@turf/bbox");
var offsetLine = require("@turf/line-offset");
var bearing = require("@turf/bearing");

function compareLines(line1, line2, options) {
    // Optional parameters
    options = options || {};
    if (!isObject(options)) throw new Error('options is invalid');
    var tolerance = options.tolerance || 0;
    var maxAngle = options.angle || 25;

    // Containers
    var features = [];
    var missing = [];

    // Create Spatial Index
    var tree = rbush();
    tree.load(lineSegment(line1));

    // Iterate over line segments
    segmentEach(line2, function (segment) {
        var doesOverlaps = false;

        // Create a buffer based on offset lines
        var offset1 = offsetLine(segment, tolerance, {units: 'kilometers'});
        var offset2 = offsetLine(segment, -tolerance, {units: 'kilometers'});

        var c1 = offset1.geometry.coordinates;
        var c2 = offset2.geometry.coordinates;

        var rect = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    c1[0],
                    c1[1],
                    c2[1],
                    c2[0],
                    c1[0]
                ]]
            }
        };

        // Find matches based on the custom buffer
        var matches = tree.search(bbox(rect));

        // Iterate over each segments which falls within the same bounds
        // featureEach(tree.search(gg), function (match) {
        for(var i = 0; i < matches.features.length; i++){

            var match = matches.features[i];

            if(!doesOverlaps){

                doesOverlaps = compareSegments(segment, match, tolerance, maxAngle);

                if(doesOverlaps){
                    // TODO: concat segments
                    features.push(segment);

                    // Skip to next segment
                    break;
                }
            }
        }

        if(!doesOverlaps){
            // TODO: concat segments
            missing.push(segment);
        }
    });

    return {
        overlaps: featureCollection(features),
        missing: featureCollection(missing)
    };
}


function compareSegments(segment, match, tolerance, maxAngle){

    var coordsSegment = getCoords(segment).sort();
    var coordsMatch = getCoords(match).sort();

    // Case 1
    // Lines are the same
    if (deepEqual(coordsSegment, coordsMatch)) {
        // console.log("> Lines are identical");
        return true;
    }

    // In 0 tolerance
    if(tolerance === 0){
        return booleanPointOnLine(coordsSegment[0], match) &&
            booleanPointOnLine(coordsSegment[1], match);
    }

    // Case 2
    // Check if delta angle is within the limit
    var angle1 = bearing(coordsSegment[0], coordsSegment[1]);
    var angle2 = bearing(coordsMatch[0], coordsMatch[1]);

    // This assumes [-180, 180]
    var diffAngle = Math.min((angle1-angle2)<0?angle1-angle2+180:angle1-angle2,
                             (angle2-angle1)<0?angle2-angle1+180:angle2-angle1);

    // Discard if angle > maxAngle
    if(diffAngle > maxAngle){
        // console.log("> Lines are not parallel");

        return false;
    }

    // Case 3
    // Check the proximity of points on segments (B -> A)
    var pt1 = nearestPointOnLine(match, coordsSegment[0]);
    var pt2 = nearestPointOnLine(match, coordsSegment[1]);

    var near1 = pt1.properties.dist <= tolerance;
    var near2 = pt2.properties.dist <= tolerance;

    var valx = Math.abs(pt1.geometry.coordinates[0] - pt2.geometry.coordinates[0]);
    var valy = Math.abs(pt1.geometry.coordinates[1] - pt2.geometry.coordinates[1]);

    if(near1 && near2 && (valx > 0 || valy > 0)){
        return true;
    } else {

        // Case 3 (A -> B)
        var pt3 = nearestPointOnLine(segment, coordsMatch[0]);
        var pt4 = nearestPointOnLine(segment, coordsMatch[1]);

        var near3 = pt3.properties.dist <= tolerance;
        var near4 = pt4.properties.dist <= tolerance;

        valx = Math.abs(pt3.geometry.coordinates[0] - pt4.geometry.coordinates[0]);
        valy = Math.abs(pt3.geometry.coordinates[1] - pt4.geometry.coordinates[1]);

        if(near3 && near4 && (valx > 0 || valy > 0)){
            // console.log("> Case 3");

            return true;
        }else {
            // Case 4
            // Segment A is shorter than B (or the other way around),
            // but still parallel and within the tolerance
            // TODO: Trim the overlaping part
            if((near1 || near2) && (near3 || near4)) {
                var pt5 = near1 ? pt1 : pt2;
                var pt6 = near3 ? pt3 : pt4;

                valx = Math.abs(pt5.geometry.coordinates[0] - pt6.geometry.coordinates[0]);
                valy = Math.abs(pt5.geometry.coordinates[1] - pt6.geometry.coordinates[1]);

                if (valx > 0 || valy > 0) {

                    // console.log("> Case 4");
                    return true;
                }
            }
        }
    }

    return false;
}


/**
 * Concat Segment
 *
 * @private
 * @param {Feature<LineString>} line LineString
 * @param {Feature<LineString>} segment 2-vertex LineString
 * @returns {Feature<LineString>} concat linestring
 */
function concatSegment(line, segment) {
    var coords = getCoords(segment);
    var lineCoords = getCoords(line);
    var start = lineCoords[0];
    var end = lineCoords[lineCoords.length - 1];
    var geom = line.geometry.coordinates;

    var add = false;

    if (deepEqual(coords[0], start)){
        geom.unshift(coords[1]);
        add = true;
    } else if (deepEqual(coords[0], end)){
        geom.push(coords[1]);
        add = true;
    } else if (deepEqual(coords[1], start)){
        geom.unshift(coords[0]);
        add = true;
    } else if (deepEqual(coords[1], end)) {
        geom.push(coords[0]);
        add = true;
    }

    if(add){
        return line;
    }else {
        return null;
    }
}

function isArguments(object) {
    return Object.prototype.toString.call(object) === '[object Arguments]';
}

function deepEqual(actual, expected, opts) {
    if (!opts) opts = {};
    // 7.1. All identical values are equivalent, as determined by ===.
    if (actual === expected) {
        return true;

    } else if (actual instanceof Date && expected instanceof Date) {
        return actual.getTime() === expected.getTime();

        // 7.3. Other pairs that do not both pass typeof value == 'object',
        // equivalence is determined by ==.
    } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
        return opts.strict ? actual === expected : actual === expected;

        // 7.4. For all other Object pairs, including Array objects, equivalence is
        // determined by having the same number of owned properties (as verified
        // with Object.prototype.hasOwnProperty.call), the same set of keys
        // (although not necessarily the same order), equivalent values for every
        // corresponding key, and an identical 'prototype' property. Note: this
        // accounts for both named and indexed properties on Arrays.
    } else {
        return objEquiv(actual, expected, opts);
    }
}

function isUndefinedOrNull(value) {
    return value === null || value === undefined;
}

function isBuffer(x) {
    if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
    if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
        return false;
    }
    if (x.length > 0 && typeof x[0] !== 'number') return false;
    return true;
}

function objEquiv(a, b, opts) {
    var i, key;
    if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
        return false;
    // an identical 'prototype' property.
    if (a.prototype !== b.prototype) return false;
    //~~~I've managed to break Object.keys through screwy arguments passing.
    //   Converting to array solves the problem.
    if (isArguments(a)) {
        if (!isArguments(b)) {
            return false;
        }
        a = pSlice.call(a);
        b = pSlice.call(b);
        return deepEqual(a, b, opts);
    }
    if (isBuffer(a)) {
        if (!isBuffer(b)) {
            return false;
        }
        if (a.length !== b.length) return false;
        for (i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    try {
        var ka = Object.keys(a),
            kb = Object.keys(b);
    } catch (e) { //happens when one is a string literal and the other isn't
        return false;
    }
    // having the same number of owned properties (keys incorporates
    // hasOwnProperty)
    if (ka.length !== kb.length)
        return false;
    //the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();
    //~~~cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
        if (ka[i] !== kb[i])
            return false;
    }
    //equivalent values for every corresponding key, and
    //~~~possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
        key = ka[i];
        if (!deepEqual(a[key], b[key], opts)) return false;
    }
    return typeof a === typeof b;
}


module.exports = compareLines;
