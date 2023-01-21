import {
	DefaultLoadingManager,
	FileLoader,
	InterleavedBuffer,
	BufferAttribute,
	InterleavedBufferAttribute
} from 'three';


// VVD: https://developer.valvesoftware.com/wiki/VVD

function memcopy( dst, dstStart, src, srcStart, len ) {

	for ( let i = 0; i < len; i ++ ) {

		dst[ dstStart + i ] = src[ srcStart + i ];

	}

}

const VVDLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : DefaultLoadingManager;

};

VVDLoader.prototype = {

	constructor: VVDLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'arraybuffer' );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text ) );

		}, onProgress, onError );

	},

	parse: function ( buffer ) {

		// https://github.com/ValveSoftware/source-sdk-2013/blob/0d8dceea4310fde5706b3ce1c70609d72a38efdf/sp/src/public/studio.h#L398
		const MAX_NUM_LODS = 8;
		// const MAX_NUM_BONES_PER_VERT = 3;

		// struct vertexFileHeader_t
		function parseHeader( buffer ) {

			const dataView = new DataView( buffer );
			let i = 0;

			// int
			const id = dataView.getInt32( i, true );
			i += 4;

			// int
			const version = dataView.getInt32( i, true );
			i += 4;

			// long
			const checksum = dataView.getInt32( i, true );
			i += 4;

			// int
			const numLODs = dataView.getUint32( i, true );
			i += 4;

			// int
			const numLODVertexes = [];
			for ( let j = 0; j < MAX_NUM_LODS; j ++ ) {

				numLODVertexes.push( dataView.getInt32( i, true ) );
				i += 4;

			}

			// int
			const numFixups = dataView.getInt32( i, true );
			i += 4;

			// int
			const fixupTableStart = dataView.getInt32( i, true );
			i += 4;

			// int
			const vertexDataStart = dataView.getInt32( i, true );
			i += 4;

			// int
			const tangentDataStart = dataView.getInt32( i, true );
			i += 4;

			return {
				id,
				version,
				checksum,
				numLODs,
				numLODVertexes,
				numFixups,
				fixupTableStart,
				vertexDataStart,
				tangentDataStart,
				buffer
			};

		}

		function parseFixups( buffer, numFixups, fixupTableStart ) {

			const dataView = new DataView( buffer );
			let offset = fixupTableStart;
			const res = [];
			for ( let i = 0; i < numFixups; i ++ ) {

				const fixup = {};
				fixup.lod = dataView.getInt32( offset + 0, true );
				fixup.sourceVertexID = dataView.getInt32( offset + 4, true );
				fixup.numVertexes = dataView.getInt32( offset + 8, true );
				offset += 12;

				res.push( fixup );

			}

			return res;

		}

		function getBufferAttribute( buffer, len, start ) {

			const interleavedFloat32Array = new Float32Array( buffer, start, len / 4 );
			const interleavedFloat32Buffer = new InterleavedBuffer( interleavedFloat32Array, 48 / 4 );
			const interleavedUint8Array = new Uint8Array( buffer, start, len );
			const interleavedUint8Buffer = new InterleavedBuffer( interleavedUint8Array, 48 );

			// VVD file describes three bone weights and indices while THREE.js requires four
			const totalVerts = len / 48;
			const skinWeightArray = new Float32Array( totalVerts * 4 );
			const skinIndexArray = new Uint8Array( totalVerts * 4 );

			for ( let i = 0; i < totalVerts; i ++ ) {

				const i4 = i * 4;
				const floatIndex = i * 12;
				skinWeightArray[ i4 + 0 ] = interleavedFloat32Array[ floatIndex + 0 ];
				skinWeightArray[ i4 + 1 ] = interleavedFloat32Array[ floatIndex + 1 ];
				skinWeightArray[ i4 + 2 ] = interleavedFloat32Array[ floatIndex + 2 ];
				skinWeightArray[ i4 + 3 ] = 0;

				const uint8Index = i * 12 * 4 + 12;
				skinIndexArray[ i4 + 0 ] = interleavedUint8Array[ uint8Index + 0 ];
				skinIndexArray[ i4 + 1 ] = interleavedUint8Array[ uint8Index + 1 ];
				skinIndexArray[ i4 + 2 ] = interleavedUint8Array[ uint8Index + 2 ];
				skinIndexArray[ i4 + 3 ] = 0;

			}

			return {

				skinWeight: new BufferAttribute( skinWeightArray, 4, false ),
				skinIndex: new BufferAttribute( skinIndexArray, 4, false ),
				numBones: new InterleavedBufferAttribute( interleavedUint8Buffer, 1, 15, false ),

				position: new InterleavedBufferAttribute( interleavedFloat32Buffer, 3, 4, false ),
				normal: new InterleavedBufferAttribute( interleavedFloat32Buffer, 3, 7, false ),
				uv: new InterleavedBufferAttribute( interleavedFloat32Buffer, 2, 10, false ),

			};

		}

		const header = parseHeader( buffer );
		const fixups = parseFixups( buffer, header.numFixups, header.fixupTableStart );

		// apply fixups
		let attributes;
		const vertArrayLength = header.tangentDataStart - header.vertexDataStart;
		if ( fixups.length !== 0 ) {

			const vertexDataStart = header.vertexDataStart;
			const newBuffer = new ArrayBuffer( vertArrayLength );
			const newUint8Buffer = new Uint8Array( newBuffer );
			const ogUint8Buffer = new Uint8Array( buffer );
			let target = 0;
			for ( let i = 0; i < fixups.length; i ++ ) {

				const fixup = fixups[ i ];
				memcopy(
					newUint8Buffer,
					target * 48,
					ogUint8Buffer,
					vertexDataStart + fixup.sourceVertexID * 48,
					fixup.numVertexes * 48,
				);
				target += fixup.numVertexes;

			}

			attributes = getBufferAttribute( newBuffer, vertArrayLength, 0 );

		} else {

			attributes = getBufferAttribute( buffer, vertArrayLength, header.vertexDataStart );

		}

		return { header, fixups, attributes, buffer };

	}

};

export { VVDLoader };
