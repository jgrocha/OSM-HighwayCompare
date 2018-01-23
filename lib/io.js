const fs = require('fs');

exports.readGeojson = function(path){
    // TODO: handle err
    let geostring = fs.readFileSync(path, 'utf-8');

    return JSON.parse(geostring);
};

exports.writeResult = function(outputFile, result){

    let gt = {
        type: 'FeatureCollection',
        features: result.gtruth
    };

    let go = {
        type: 'FeatureCollection',
        features: result.osm
    };

    let pm = {
        type: 'FeatureCollection',
        features: result.pmissing
    };

    let mi = {
        type: 'FeatureCollection',
        features: result.missing
    };

    let up = {
        type: 'FeatureCollection',
        features: result.update
    };

    let geojsonString = JSON.stringify({
        gtruth: gt,
        osm: go,
        pmissing: pm,
        missing: mi,
        update: up
    });

    fs.writeFile(outputFile, geojsonString, function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });
};
