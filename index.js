'use strict';

const argv = require('minimist')(process.argv.slice(2));
const mapper = require("./mapper");

/**
 * Main
 *
 * ex: nodejs index.js -g groundtruthFile -m mbtilesFile -b boundingboxFile -t #threads -o outputFile (optional)
 */
function highwayCompare(){

    // Stop on wrong input
    if(!argv.g || !argv.b || !argv.m){

        console.log('[HighwayCompare]');
        console.log('Params: ');
        console.log('   -g groundtruthFile');
        console.log('   -b boundingboxFile');
        console.log('   -m mbtilesFile');
        console.log('   -t #threads (OPTIONAL)');
        console.log('   -o output (OPTIONAL)');

        return;
    }

    // Set the ground truth, bounding box and osm tiles
    let params = {
        gtruth: argv.g,
        bbox: argv.b,
        mbtiles: argv.m,
        threads: (argv.t && Number.isInteger(argv.t) && argv.t > 0 && argv.t % 2 === 0) ? argv.t : 4,
        output: argv.o ? argv.o : './osmdiff.geojson' // Optional output file
    };

    // Call map
    mapper(params);
}

highwayCompare();
