'use strict';

const tileReduce = require('@mapbox/tile-reduce');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const iogeojson = require('./lib/io');

function mainCicle(){

    // Stop on wrong input
    if(!argv.g || !argv.b || !argv.m){
        console.log('[Info] Please use -g, -b and -m to define the groundtruth, bounding box and osm layer respectively...');

        return;
    }

    // Set the ground truth, bounding box and osm tiles
    let inputGroundtruth = argv.g,
        inputBBox = argv.b,
        inputMbtiles = argv.m;

    // Optional output file
    let outputFile = argv.o ? argv.o : './osmdiff.geojson';

    // Agregate the result of reduce within these
    let groundtruth = [],
        osm = [],
        partialMissing = [],
        missing = [];

    // Read the bbox for this dataset
    let boundingBox = iogeojson.readGeojson(inputBBox);

    // Set and start tilereduce
    tileReduce({
        zoom: 12,
        map: path.join(__dirname, '/reducer.js'),
        sources: [
            {
                name: 'MBTiles',
                mbtiles: path.join(__dirname, inputMbtiles),
                raw: true
            }
        ],
        maxWorkers: 4,
        geojson: boundingBox,
        mapOptions: {
            groundtruthFile: inputGroundtruth
        }
    })
    .on('map', function (tile, workerId) {
        console.log('about to process ' + JSON.stringify(tile) +' on worker '+workerId);
    })
    .on('reduce', function (result, tile) {
        groundtruth = groundtruth.concat(result.groundtruth);
        osm = osm.concat(result.osm);
        partialMissing = partialMissing.concat(result.partialMissing);
        missing = missing.concat(result.missing);
    })
    .on('end', function () {
        iogeojson.writeResult(outputFile, groundtruth, osm, partialMissing, missing);
    });
}

mainCicle();
