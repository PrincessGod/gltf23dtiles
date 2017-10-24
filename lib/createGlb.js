'use strict';
var Cesium       = require('cesium');
var gltfPipeline = require('gltf-pipeline');

var defaultValue = Cesium.defaultValue;

var addPipelineExtras = gltfPipeline.addPipelineExtras;
var combinePrimitives = gltfPipeline.combinePrimitives;
var getBinaryGltf     = gltfPipeline.getBinaryGltf;
var loadGltfUris      = gltfPipeline.loadGltfUris;
var processFile       = gltfPipeline.Pipeline.processFile;

module.exports = createGlb;

var sizeOfUint16 = 2;

/**
 * Create glb from glTF with _BATCHID per-mesh.
 * 
 * @param {Object} options Object with the following properties.
 * @param {String} options.gltf The gltf file path.
 * @param {Boolean} [options.optimize=true] Optimize the glTF by conbine primitives as much as possible.
 * 
 * @returns {Promise} A promise that resolves with the binary glb buffer.
 */
function createGlb(options) {
    var optimize = defaultValue(options.optimizeForCesium, true);
    var gltfPath = options.gltf;
    return processFile(gltfPath)
        .then(function (gltf) {
            if (optimize) {
                combinePrimitives(gltf);
            }
            modifyGltfWithBatchIds(gltf);
            return convertToBinaryGltf(gltf);
        });
}

function convertToBinaryGltf(gltf) {
    addPipelineExtras(gltf);
    return loadGltfUris(gltf)
        .then(function (gltf) {
            return getBinaryGltf(gltf, true, true).glb;
        });
}

function modifyGltfWithBatchIds(gltf) {
    var i;
    var length;
    var batchIdsInfo = [];
    var accessors = gltf.accessors;

    var meshes = gltf.meshes;
    for (var meshId in meshes) {
        if (meshes.hasOwnProperty(meshId)) {
            var primitives = meshes[meshId].primitives;
            length = primitives.length;
            var batchidBufferFrag = {
                name:   meshes[meshId].name,
                mashId: meshId,
                count:  0,
            };

            for (i = 0; i < length; i++) {
                var primitive   = primitives[i];
                var accessorsId = primitive.attributes.POSITION;
                var pointCount  = accessors[accessorsId].count;
                if (batchidBufferFrag.count < pointCount) {
                    batchidBufferFrag.count = pointCount;
                }
            }

            batchIdsInfo.push(batchidBufferFrag);
        }
    }

    var batchIds = [];
    for (i = 0, length = batchIdsInfo.length; i < length; i++) {
        for (var j = 0; j < batchIdsInfo[i].count; j++) {
            batchIds.push(batchIdsInfo[i].mashId);
        }
    }

    var batchIdsLength = batchIds.length;
    var batchIdsBuffer = Buffer.alloc(batchIdsLength * sizeOfUint16);
    for (i = 0; i < batchIdsLength; i++) {
        batchIdsBuffer.writeUInt16LE(batchIds[i], sizeOfUint16);
    }
    var batchIdsBufferUri = 'data:application/octet-stream;base64,' + batchIdsBuffer.toString('base64');
    var batchIdSemantic = '_BATCHID';

    var batchIdsBufferId = gltf.buffers.length;
    gltf.buffers[batchIdsBufferId] = {
        byteLength: batchIdsBuffer.length,
        name:       'buffer_batchId',
        uri:        batchIdsBufferUri
    };

    var batchIdsBufferViewsId = gltf.bufferViews.length;
    gltf.bufferViews[batchIdsBufferViewsId] = {
        buffer:     batchIdsBufferId,
        byteLength: batchIdsBuffer.length,
        byteOffset: 0,
        name:       'bufferViews_batchId',
        target:     34962 // ARRAY_BUFFER
    };

    var batchIdsAccssorsBaseId = accessors.length;
    var byteOffset = 0;
    for (i = 0; i < batchIdsInfo.length; i++) {
        accessors[batchIdsAccssorsBaseId + i] = {
            bufferView:    batchIdsBufferViewsId,
            byteOffset:    byteOffset,
            byteStride:    0,
            componentType: 5123, // UNSIGNED_SHORT
            count:         batchIdsInfo[i].count,
            type:          'SCALAR',
            min:           batchIdsInfo[i].mashId,
            max:           batchIdsInfo[i].mashId,
            name:          'accessor_buffer_batchId_' + batchIdsInfo[i].name
        };
        byteOffset += batchIdsInfo[i].count * sizeOfUint16;
        batchIdsInfo[i].accessorsId = batchIdsAccssorsBaseId + i;
    }

    for (i = 0; i < batchIdsInfo.length; i++) {
        var id = batchIdsInfo[i].mashId;
        var primiivess = meshes[id].primitive;
        length = primiivess.length;
        for (i = 0; i < length; i++) {
            var primit = primiivess[i];
            primit.attributes[batchIdSemantic] = batchIdsInfo[i].accessorsId;
        }
    }

}
