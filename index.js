'use strict';

const tileReduce = require('@mapbox/tile-reduce');
const path = require('path');

const iogeojson = require('./lib/io');

function mainCicle(){

    // TODO: Process input arguments
    let inputGroundtruth = './data/groundtruth.geojson';
    let inputBBox = './data/bbox.geojson';
    let inputMbtiles = 'data/portugal.mbtiles';
    let outputFile = './data/osmdiff.geojson';

    // Read the bbox for this dataset
    var boundingBox = iogeojson.readGeojson(inputBBox);

    var groundtruth = [];
    var osm = [];
    var partialMissing = [];
    var missing = [];

    tileReduce({
        zoom: 12,
        map: path.join(__dirname, '/reducer.js'),
        sources: [
            {
                name: 'portugal',
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
