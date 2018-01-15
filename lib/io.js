const fs = require('fs');

exports.readGeojson = function(path){
    // TODO: handle err
    let geostring = fs.readFileSync(path, 'utf-8');

    return JSON.parse(geostring);
};

exports.writeResult = function(outputFile, groundtruth, osm, partialMissing, missing){

    let gt = {
        type: 'FeatureCollection',
        features: groundtruth
    };

    let go = {
        type: 'FeatureCollection',
        features: osm
    };

    let pm = {
        type: 'FeatureCollection',
        features: partialMissing
    };

    let mi = {
        type: 'FeatureCollection',
        features: missing
    };

    let result = {
        groundtruth: gt,
        osm: go,
        partialMissing: pm,
        missing: mi
    };

    fs.writeFile(outputFile, JSON.stringify(result), function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });
};
