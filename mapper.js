'use strict';

const tileReduce = require('@mapbox/tile-reduce');
const path = require('path');
const iogeojson = require('./lib/io');

/**
 * Map function from TileReduce. Starts the process of highway compare
 *
 * @param params - json object
 *  ex:
 *    {
 *       box: boundingboxFile,
 *       mbtiles: mbtilesFile,
 *       gtruth: groundtruthFile,
 *       output: outputFile
 *    }
 */
const mapper = function(params){

    // Agregate the result of reduce within these
    let result = {
        gtruth: [],
        osm: [],
        pmissing: [],
        missing: [],
        update: []
    };

    // Read the bbox for this dataset
    let boundingBox = iogeojson.readGeojson(params.bbox);

    // Set and start tilereduce
    tileReduce({
        zoom: 12,
        map: path.join(__dirname, '/reducer.js'),
        sources: [
            {
                name: 'osmtiles',
                mbtiles: path.join(__dirname, params.mbtiles),
                raw: true
            }
        ],
        maxWorkers: params.threads,
        geojson: boundingBox,
        mapOptions: {
            groundtruthFile: params.gtruth
        }
    })
    .on('map', function (tile, workerId) {
        console.log('about to process ' + JSON.stringify(tile) +' on worker '+workerId);
    })
    .on('reduce', function (reduceResult, tile) {
        result.gtruth = result.gtruth.concat(reduceResult.gtruth);
        result.osm = result.osm.concat(reduceResult.osm);
        result.pmissing = result.pmissing.concat(reduceResult.pmissing);
        result.missing = result.missing.concat(reduceResult.missing);
        result.update = result.update.concat(reduceResult.update);
    })
    .on('end', function () {
        iogeojson.writeResult(params.output, result);
    });
};

module.exports = mapper;


