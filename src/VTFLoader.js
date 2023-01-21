import {
	CompressedTextureLoader,
	RGBAFormat,
	RGBFormat,
	RGB_S3TC_DXT1_Format,
	RGBA_S3TC_DXT3_Format,
	RGBA_S3TC_DXT5_Format,
	LinearFilter,
	LinearMipmapLinearFilter,
} from 'three';

// VTF: https://developer.valvesoftware.com/wiki/Valve_Texture_Format

// TODO: The mipmap filter type needs to be updated to LinearFilter for some reason
// TODO: get cube maps, animations, volume textures
const VTFLoader = function ( manager ) {

	CompressedTextureLoader.call( this, manager );

	this._parser = VTFLoader.parse;

};

VTFLoader.prototype = Object.create( CompressedTextureLoader.prototype );
VTFLoader.prototype.constructor = VTFLoader;

VTFLoader.prototype.parse = function ( buffer ) {

	function bgrToRgb( buffer, stride ) {

		for ( let i = 0, l = buffer.length; i < l; i += stride ) {

			const b = buffer[ i ];
			const r = buffer[ i + 2 ];
			buffer[ i ] = r;
			buffer[ i + 2 ] = b;

		}

	}

	function parseHeader( buffer ) {

		const dataView = new DataView( buffer );
		let i = 0;
		let signature = '';
		for ( var j = 0; j < 4; j ++ ) {

			signature += String.fromCharCode( dataView.getUint8( i, true ) );
			i ++;

		}

		const version = [ dataView.getUint32( i, true ), dataView.getUint32( i + 4, true ) ];
		i += 8;

		const headerSize = dataView.getUint32( i, true );
		i += 4;

		const width = dataView.getUint16( i, true );
		i += 2;

		const height = dataView.getUint16( i, true );
		i += 2;

		const flags = dataView.getUint32( i, true );
		i += 4;

		const frames = dataView.getUint16( i, true );
		i += 2;

		const firstFrame = dataView.getUint16( i, true );
		i += 2;

		// padding0
		i += 4;

		const reflectivity = [];
		for ( var j = 0; j < 3; j ++ ) {

			reflectivity.push( dataView.getFloat32( i, true ) );
			i += 4;

		}

		// padding1
		i += 4;

		const bumpmapScale = dataView.getFloat32( i, true );
		i += 4;

		const highResImageFormat = dataView.getUint32( i, true );
		i += 4;

		const mipmapCount = dataView.getUint8( i, true );
		i += 1;

		const lowResImageFormat = dataView.getUint32( i, true );
		i += 4;

		const lowResImageWidth = dataView.getUint8( i, true );
		i += 1;

		const lowResImageHeight = dataView.getUint8( i, true );
		i += 1;

		// 7.2+
		const depth = dataView.getUint16( i, true );
		i += 2;

		// 7.3+
		// padding2
		i += 3;

		const numResources = dataView.getUint32( i, true );
		i += 4;

		return {
			signature,
			version,
			headerSize,
			width,
			height,
			flags,
			frames,
			firstFrame,
			reflectivity,
			bumpmapScale,
			highResImageFormat,
			mipmapCount,
			lowResImageFormat,
			lowResImageWidth,
			lowResImageHeight,
			depth,
			numResources
		};

	}

	function getMipMap( buffer, offset, format, width, height ) {

		const dxtSz = Math.max( 4, width ) / 4 * Math.max( 4, height ) / 4;
		let threeFormat = null;
		let byteArray = null;

		switch ( format ) {

		case 0: // RGBA8888
			var dataLength = width * height * 4;
			byteArray = new Uint8Array( buffer, offset, dataLength );
			threeFormat = RGBAFormat;
			break;
		case 1: // ABGR8888
			var dataLength = width * height * 4;
			byteArray = new Uint8Array( buffer, offset, dataLength );

			for ( let i = 0, l = byteArray.length; i < l; i += 4 ) {

				const a = byteArray[ i ];
				const b = byteArray[ i + 1 ];
				const g = byteArray[ i + 2 ];
				const r = byteArray[ i + 3 ];
				byteArray[ i ] = r;
				byteArray[ i + 1 ] = g;
				byteArray[ i + 2 ] = b;
				byteArray[ i + 3 ] = a;

			}

			threeFormat = RGBAFormat;
			break;
		case 2: // RGB888
			var dataLength = width * height * 3;
			byteArray = new Uint8Array( buffer, offset, dataLength );
			threeFormat = RGBFormat;
			break;
		case 3: // BGR888
			var dataLength = width * height * 3;
			byteArray = new Uint8Array( buffer, offset, dataLength );
			bgrToRgb( byteArray, 3 );
			threeFormat = RGBFormat;
			break;
		case 12: // BGRA8888
			var dataLength = width * height * 4;
			byteArray = new Uint8Array( buffer, offset, dataLength );
			bgrToRgb( byteArray, 4 );
			threeFormat = RGBAFormat;
			break;
		case 13: // DXT1
			var dataLength = dxtSz * 8; // 8 blockBytes
			byteArray = new Uint8Array( buffer, offset, dataLength );
			threeFormat = RGB_S3TC_DXT1_Format;
			break;
		case 14: // DXT3
			var dataLength = dxtSz * 16; // 16 blockBytes
			byteArray = new Uint8Array( buffer, offset, dataLength );
			threeFormat = RGBA_S3TC_DXT3_Format;
			break;
		case 15: // DXT5
			var dataLength = dxtSz * 16; // 16 blockBytes
			byteArray = new Uint8Array( buffer, offset, dataLength );
			threeFormat = RGBA_S3TC_DXT5_Format;
			break;
		default:
			console.error( `VTFLoader: Format variant ${ format } is unsupported.` );
			return null;

		}

		return {

			format: threeFormat,
			data: byteArray,
			width,
			height

		};

	}

	function parseMipMaps( buffer, header ) {

		let offset = 80;
		if ( header.lowResImageHeight !== 0 ) {

			const lowResMap = getMipMap( buffer, offset, header.lowResImageFormat, header.lowResImageWidth, header.lowResImageHeight );
			offset += lowResMap.data.length;

			if ( header.version[ 0 ] > 7 || header.version[ 1 ] >= 3 ) {

				offset += header.headerSize - 80;

			}

		}

		const dimensions = new Array( header.mipmapCount );
		let currWidth = header.width;
		let currHeight = header.height;
		for ( var i = header.mipmapCount - 1; i >= 0; i -- ) {

			dimensions[ i ] = { width: currWidth, height: currHeight };
			currWidth = ( currWidth >> 1 ) || 1;
			currHeight = ( currHeight >> 1 ) || 1;

		}

		// smallest to largest
		let mipmaps = [];
		for ( var i = 0; i < header.mipmapCount; i ++ ) {

			let { width, height } = dimensions[ i ];
			const map = getMipMap( buffer, offset, header.highResImageFormat, width, height );
			mipmaps.push( map );
			offset += map.data.length;

			width = width << 1;
			height = height << 1;

		}

		mipmaps = mipmaps.reverse();

		return {

			mipmaps: mipmaps,
			width: header.width,
			height: header.height,
			format: mipmaps[ 0 ].format,
			mipmapCount: mipmaps.length

		};

	}

	const header = parseHeader( buffer );
	return parseMipMaps( buffer, header );

};

VTFLoader.prototype.load = function ( url, onComplete, ...rest ) {

	const tex = CompressedTextureLoader.prototype.load.call(
		this,
		url,
		tex => {

			// set unpack alignment to 1 if using 3-stride RGB data
			if ( tex.format === RGBFormat ) {

				tex.unpackAlignment = 1;

			}

			if ( onComplete ) {

				onComplete( tex );

			}

		},
		...rest
	);


	tex.minFilter = LinearMipmapLinearFilter;
	tex.magFilter = LinearFilter;

	return tex;

};

export { VTFLoader };
