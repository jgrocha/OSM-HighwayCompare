# OSM-HighwayCompare

A simple NodeJs tool that compares geospatial features (highways for now) from an up-to-date layer to OpenStreetMap data
and returns any missing geometries. Uses Tile-Reduce, a geoprocessing library that implements
[MapReduce](https://en.wikipedia.org/wiki/MapReduce), to scale this comparison into the large.

## Dependencies
* [Tile-Reduce](https://github.com/mapbox/tile-reduce)
* [Turfjs](https://github.com/Turfjs/turf)

## Usage

For now just call:

```
nodejs index.js
```

The output "osmdiff.geojson" will contain four sets of feature collections: the groundtruth and osm layer corresponding
 to the input bounding box and the computed missing and partially missing geometries.

## Dataset

Coming very soon...

## Example

An output example computed by this tool. The outdated OSM layer styled in blue lines. In red lines,
the missing geometries. And in red dashed lines the partially missing.
![](images/osm-compare-example.png)