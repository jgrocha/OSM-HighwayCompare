'use strict';

// Npm imports
const tilebelt = require('@mapbox/tilebelt');
const turfLength = require('@turf/length');
const bboxClip = require('@turf/bbox-clip');

// Custom imports
const compareLines = require('./lib/compareLines');
const iogeojson = require('./lib/io');

const err = 0.1;
const overlapTolerance = {
    tolerance: 0.010,
    angle: 15
};
const lengthUnits = {
    units: 'kilometers'
};

// TODO: complete this list
const highwayList = [
    'bridleway',
    'cycleway',
    'footway',
    'living_street',
    'motorway',
    'motorway_link',
    'path',
    'primary',
    'primary_link',
    'residential',
    'road',
    'secondary',
    'secondary_link',
    'service',
    'sidewalk',
    'steps',
    'tertiary',
    'tertiary_link',
    'track',
    'trunk',
    'trunk_link',
    'unclassified' ];

const reducer = function (data, tile, writeData, done) {

    let result = {
        groundtruth: [],
        osm: [],
        partialMissing: [],
        missing: []
    };

    // Bounding box for tile
    const bbox = tilebelt.tileToBBOX(tile);

    // TODO: Reading the entire dataset every time is obviously not efficient...
    let groundtruth = iogeojson.readGeojson(global.mapOptions.groundtruthFile);

    // If we save the complete geojson
    // Cycle 1 time through osm
    for (let i = 0; i < data.portugal.osm.length; i++) {

        let osmfeature = data.portugal.osm.feature(i);
        let osmgeom = osmfeature.toGeoJSON(tile[0], tile[1], tile[2]);

        if(!osmfeature.properties.highway || highwayList.indexOf(osmfeature.properties.highway) === -1){
            continue;
        }

        result.osm.push(osmgeom);
    }

    // Cycle through groundtruth and find diferences
    groundtruth.features.forEach(function(gtfeature){
        let clippedFeature = bboxClip(gtfeature.geometry, bbox);

        let clippedGeometry = clippedFeature.geometry;

        if(clippedGeometry.coordinates.length === 0){
            // Skip to next
            return;
        }

        // We want to process the clipped geometry
        gtfeature.geometry = clippedGeometry;

        // If we save the complete geojson
        result.groundtruth.push(gtfeature);

        let foundMatch = false;
        let overallCoverage = 0.0; // Should be ~1

        // Cycle through every osm feature and find first occurrence of a bbox intersect feature
        for (let i = 0; i < data.portugal.osm.length; i++) {

            let osmfeature = data.portugal.osm.feature(i);
            let osmgeom = osmfeature.toGeoJSON(tile[0], tile[1], tile[2]);

            if(!osmfeature.properties.highway ||
                highwayList.indexOf(osmfeature.properties.highway) === -1){
                continue;
            }

            // How much B fits in A for A,B
            let overlapInfo = compareLines(osmgeom, gtfeature, overlapTolerance);

            let overlaps = overlapInfo.overlaps;

            // If overlaps
            if(overlaps.features.length > 0){

                let lenFeature = turfLength(gtfeature, lengthUnits);
                let lenOverlap = turfLength(overlaps, lengthUnits);

                // Update the overall coverage percentage
                overallCoverage = overallCoverage + ((lenOverlap / lenFeature) * (1.0 - overallCoverage));

                foundMatch = true;

                if(overallCoverage <= 1.0 + err && overallCoverage > 1.0 - err){
                    // Completelly overlaps
                    // do nothing...

                    break;
                } else {
                    // Partially overlaps, continue...reset geometry to what's missing
                    gtfeature = overlapInfo.missing;
                }
            }
        }

        // console.log("> Coverage was " + overallCoverage);

        // Something went wrong if it hits any of these conditions
        if(overallCoverage === 0.0 && foundMatch){
            console.log("[Err] Invalid 0.0%")
        } else if(overallCoverage > 1.0 + err){
            console.log("[Err] Invalid % > 1.0  ---> " + overallCoverage);
        }

        // Process the result
        if(!foundMatch){
            // Didnt find a match

            gtfeature.properties.coverage = overallCoverage;

            result.missing.push(gtfeature);
        } else if(overallCoverage <= 1.0 + err && overallCoverage > 1.0 - err){
            // Found a match that completely overlaps
            // do nothing for now...
        } else {
            // Found a match that partially overlaps
            // Store the missing segments

            gtfeature.features.forEach(function(segment){
                segment.properties.coverage = overallCoverage;

                result.partialMissing.push(segment);
            });
        }
    });

    return done(null, result);
};

// Export reducer to be used by map
module.exports = reducer;
