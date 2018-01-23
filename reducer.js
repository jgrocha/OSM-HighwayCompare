'use strict';

// Npm imports
const tilebelt = require('@mapbox/tilebelt');
const turfLength = require('@turf/length');
const bboxClip = require('@turf/bbox-clip');

// Custom imports
const compareLines = require('./lib/compareLines');
const iogeojson = require('./lib/io');
const cloneJson = require('./lib/utils').cloneJson;

// TODO: to be removed in the future
// accuracy error to account the trimming of line (multiline) geometries
const coverageErr = 0.1;

// tolerance distance to compare lines (in kilometers)
// max angle to consider two lines as parallel
const overlapTolerance = {
    tolerance: 0.010,
    angle: 15
};

// Line length measure unit
const lengthUnits = {
    units: 'kilometers'
};

// TODO: complete this list
// Classification list to filter highways from the osm layer
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

/**
 * Reducer from TileReduce
 * @param data: data from the mbtiles database
 * @param tile:
 * @param writeData
 * @param done: callback
 * @returns {*}
 */
const reducer = function (data, tile, writeData, done) {

    let result = {
        gtruth: [],
        osm: [],
        pmissing: [],
        missing: [],
        update: []
    };

    // Bounding box for tile
    const bbox = tilebelt.tileToBBOX(tile);

    // TODO: Reading the entire dataset every time is obviously not efficient...
    let groundtruth = iogeojson.readGeojson(global.mapOptions.groundtruthFile);

    // If we save the complete geojson
    // Cycle 1 time through osm
    for (let i = 0; i < data.osmtiles.osm.length; i++) {

        let osmfeature = data.osmtiles.osm.feature(i);
        let osmgeom = osmfeature.toGeoJSON(tile[0], tile[1], tile[2]);

        if(!osmfeature.properties.highway || highwayList.indexOf(osmfeature.properties.highway) === -1){
            continue;
        }

        result.osm.push(osmgeom);
    }

    // Cycle through groundtruth and find diferences
    groundtruth.features.forEach(function(gtfeature){

        // Clip the feature into the bbox of the current tile
        let clippedFeature = bboxClip(gtfeature.geometry, bbox);

        let clippedGeometry = clippedFeature.geometry;

        // If the geometry isn't within the bbox
        if(clippedGeometry.coordinates.length === 0){
            // Skip to next
            return;
        }

        // We want to process the clipped geometry
        // This is to account geometries that cross the boundary of tiles
        gtfeature.geometry = clippedGeometry;

        let gtfeatureOriginal = cloneJson(gtfeature);

        // Store the current geometry to compare with the result
        result.gtruth.push(gtfeature);

        // Overall coverage between multiple osm geometries with the current groundtruth geometry.
        // 0 = does not overlap, 1 = totally overlaps, ]0, 1[ = partially overlaps
        let overallCoverage = 0.0;

        // Indexes of matched osm features
        let matchedIdx = [];

        // Cycle through every filtered osm feature
        for (let i = 0; i < result.osm.length; i++) {

            let osmgeom = result.osm[i];

            // How much B fits in A for A,B
            let comparison = compareLines(osmgeom, gtfeature, overlapTolerance);

            let overlaps = comparison.overlaps;

            // If overlaps
            if(overlaps.features.length > 0){

                matchedIdx.push(i);

                let lenFeature = turfLength(gtfeature, lengthUnits);
                let lenOverlap = turfLength(overlaps, lengthUnits);

                // Update the overall coverage percentage
                overallCoverage = overallCoverage + ((lenOverlap / lenFeature) * (1.0 - overallCoverage));

                if(overallCoverage <= 1.0 + coverageErr && overallCoverage > 1.0 - coverageErr){
                    // Completelly overlaps
                    break;
                } else {
                    // Partially overlaps, continue...reset geometry to what's missing
                    gtfeature = comparison.missing;
                }
            }
        }

        // console.log("> Coverage was " + overallCoverage);

        // Something went wrong if it hits any of these conditions
        if(overallCoverage > 1.0 + coverageErr){
            console.log("[Err] Invalid % > 1.0  ---> " + overallCoverage);
        }

        // Process the result
        if(overallCoverage === 0.0){
            // Didnt find a match

            result.missing.push(gtfeatureOriginal);
        } else if(overallCoverage <= 1.0 + coverageErr && overallCoverage > 1.0 - coverageErr){
            // Found a match that completely overlaps
            // do nothing for now...

            // Update the properties of every feature matched
            matchedIdx.forEach(function(hit){
                let osmfeature = result.osm[hit];

                let missingProperties = compareProperties(gtfeatureOriginal, osmfeature);

                if(missingProperties){
                    let toUpdate = {
                        type: osmfeature.type,
                        geometry: osmfeature.geometry,
                        properties: {
                            '@id': osmfeature.properties['@id'],
                            '@uid': osmfeature.properties['@uid'],
                            'name': missingProperties['name']
                        }
                    };

                    result.update.push(toUpdate);
                }
            });

        } else {
            // Found a match that partially overlaps
            // Store the missing segments

            gtfeature.features.forEach(function(segment){

                let clonedSegment = cloneJson(segment);

                clonedSegment.properties.coverage = overallCoverage;

                result.pmissing.push(clonedSegment);
            });
        }
    });

    return done(null, result);
};

const compareProperties = function (gtfeature, osmfeature){

    let gtProps = gtfeature.properties;
    let osmProps = osmfeature.properties;

    // For now, only compare the name
    if(!osmProps.ref && gtProps.name){
        if(!osmProps.name || osmProps.name ===''){
            return {name: gtProps.name};
        } else {
            // TODO: Compare names in a iLike way
            return null;//{name: gtProps.name};
        }
    }

    return null;
};

// Export reducer to be used by map
module.exports = reducer;
