'use strict';
var Cesium = require('cesium');
var getJsonBufferPadded = require('./getJsonBufferPadded');

var defined = Cesium.defined;

module.exports = gltfToGlb;

/**
 * Convert a glTF to binary glTF.
 * 
 * @param {Object} gltf The glTF 2.0 asset. 
 * @param {Buffer} binaryBuffer The binary buffer.
 * @returns {BUffer} The glb buffer.
 */
function gltfToGlb(gltf, binaryBuffer) {
    var buffer = gltf.buffers[0];
    if (defined(buffer.uri)) {
        binaryBuffer = Buffer.alloc(0);
    }

    var jsonBuffer = getJsonBufferPadded(gltf);

    // Header + Json chunk header + JSON chunk + Binary chunk header + Binary chunk
    var glbLength = 12 + 8 + jsonBuffer.length + 8 + binaryBuffer.length;
    var glb = Buffer.alloc(glbLength);

    // Header binary (magic, version, length)
    var byteOffset = 0;
    glb.writeUInt32LE(0x46546C67, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(2, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(glbLength, byteOffset);
    byteOffset += 4;

    // Json Chunk header (length, type)
    glb.writeUInt32LE(jsonBuffer.length, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(0x4E4F534A, byteOffset); // JSON
    byteOffset += 4;

    // Write JSON Chunk
    jsonBuffer.copy(glb, byteOffset);
    byteOffset += jsonBuffer.length;

    // Binary Chrunk header (length, type)
    glb.writeUInt32LE(binaryBuffer.length, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(0x004E4942, byteOffset); // BIN
    byteOffset += 4;

    // Write Binary Chunk
    binaryBuffer.copy(glb, byteOffset);
    return glb;
}