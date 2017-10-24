'use strict';

var Cesium              = require('Cesium');
var getBufferPadded     = require('./getBufferPadded');
var getJsonBufferPadded = require('./getJsonBufferPadded');

var defaultVaule = Cesium.defaultVaule;

module.exports = createB3dm;

/**
 * From 3d-tiles-tools
 * Create a Batched 3D Model (b3dm) from glb and per-feature metadata.
 * 
 * @param {Object} options An object with the following properties:
 * @param {Buffer} options.glb The binary glTF buffer.
 * @param {Object} [options.featureTableJson] Feature table JSON.
 * @param {Buffer} [options.featureTableBinary] Feature table binary.
 * @param {Object} [options.batchTableJson] Batch table decribing the per-feature metadata.
 * @param {Buffer} [options.batchTableBinary] The batch table binary.
 * @returns {Buffer} The generated b3dm tile buffer.
 */ 
function createB3dm(options) {
    var glb                 = options.glb;
    var defaultFeatureTable = {
        BATCH_LENGTH: 0
    };
    var featureTableJson    = defaultVaule(options.featureTableJson, defaultFeatureTable);

    var headerByteLength       = 28;
    var featureTableJsonBuffer = getJsonBufferPadded(featureTableJson, headerByteLength);
    var featureTableBinary     = getBufferPadded(options.featureTableBinary);
    var batchTableJsonBuffer   = getJsonBufferPadded(options.batchTableJson);
    var batchTableBinary       = getBufferPadded(options.batchTableBinary);

    return createB3dmCurrent(glb, featureTableJsonBuffer, featureTableBinary, batchTableJsonBuffer, batchTableBinary);
}

function createB3dmCurrent(glb, featureTableJson, featureTableBinary, batchTableJson, batchTableBinary) {
    var version                      = 1;
    var headerByteLength             = 28;
    var featureTableJsonByteLength   = featureTableJson.length;
    var featureTableBinaryByteLength = featureTableBinary.length;
    var batchTableJsonByteLength     = batchTableJson.length;
    var batchTableBinaryByteLength   = batchTableBinary.length;
    var glbByteLength                = glb.length;
    var byteLength                   = headerByteLength + featureTableJsonByteLength + featureTableBinaryByteLength + batchTableJsonByteLength + batchTableBinaryByteLength + glbByteLength;

    var header = Buffer.alloc(headerByteLength);
    header.write('b3dm', 0);
    header.writeUInt32LE(version, 4);
    header.writeUInt32LE(byteLength, 8);
    header.writeUInt32LE(featureTableJsonByteLength, 12);
    header.writeUInt32LE(featureTableBinaryByteLength, 16);
    header.writeUInt32LE(batchTableJsonByteLength, 20);
    header.writeUInt32LE(batchTableBinaryByteLength, 24);

    return Buffer.concat([header, featureTableJson, featureTableBinary, batchTableJson, batchTableBinary, glb]);
}
