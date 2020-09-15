import {
	DefaultLoadingManager,
	FileLoader,
	MeshPhongMaterial,
	RepeatWrapping,
	LinearEncoding,
} from 'three';
import { VTFLoader } from './VTFLoader.js';

// VMT: https://developer.valvesoftware.com/wiki/VMT

function addExt( path, ext ) {

	const re = new RegExp( `.${ ext }$`, 'i' );
	if ( re.test( path ) ) return path;
	else return `${ path }.${ ext }`;

}

const VMTLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : DefaultLoadingManager;

};

VMTLoader.prototype = {

	constructor: VMTLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'text' );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text, url ) );

		}, onProgress, onError );

	},

	// TODO: Fix this url use and follow the "path" pattern of other loaders
	parse: function ( string, url ) {

		let type = null;
		let root = null;
		const objects = [];
		let currData = '';
		for ( let i = 0, l = string.length; i < l; i ++ ) {

			const c = string[ i ];
			if ( c === '{' ) {

				const newObj = {};
				if ( objects.length === 0 ) {

					type += currData;

				} else {

					objects[ objects.length - 1 ][ currData.trim() ] = newObj;

				}

				objects.push( newObj );
				if ( root === null ) root = newObj;

				currData = '';

			} else if ( c === '}' ) {

				objects.pop();

			} else if ( c === '\n' ) {

				if ( objects.length === 0 ) {

					type += currData;

				} else {

					const tokens = currData.trim().split( /\s+/ );
					if ( tokens.length >= 2 ) {

						let [ name, contents ] = tokens.map( t => t.replace( /"/g, '' ) );

						if ( /^\[/.test( contents ) ) {

							contents = contents
								.replace( /[\[\]]/g, '' )
								.split( /\s+/g )
								.map( n => parseFloat( n ) );

						} else if ( /^\d*\.?\d*$/.test( contents ) ) {

							contents = parseFloat( contents );

						}

						objects[ objects.length - 1 ][ name ] = contents;


					}

				}
				currData = '';

			} else {

				currData += c;

			}

		}

		// TODO: Repeat wrapping should be handled in the VFT loads
		const urlTokens = url.split( /materials/i );
		urlTokens.pop();

		const path = `${ urlTokens.join( 'materials' ) }materials/`;
		const material = new MeshPhongMaterial();
		const vtfLoader = new VTFLoader( this.manager );
		for ( const key in root ) {

			// TODO: Use more keys
			// TODO: bump map is causing all normals to disappear here
			const field = root[ key ];
			switch ( key.toLowerCase() ) {

				case '$basetexture':
					material.map = vtfLoader.load( addExt( `${ path }${ field }`, 'vtf' ) );
					material.map.wrapS = RepeatWrapping;
					material.map.wrapT = RepeatWrapping;
					material.map.encoding = LinearEncoding;
					break;
				case '$bumpmap':
					// TODO: This doesn't seem to quite map correctly to normal map
					// material.normalMap = vtfLoader.load( addExt( `${ path }${ field }`, '.vtf' ) );
					// material.normalMap.wrapS = RepeatWrapping;
					// material.normalMap.wrapT = RepeatWrapping;
					break;
				case '$phongexponenttexture':
					// TODO: This doesn't quite map appropriately to a specular map
					material.specularMap = vtfLoader.load( addExt( `${ path }${ field }`, '.vtf' ) );
					material.specularMap.wrapS = RepeatWrapping;
					material.specularMap.wrapT = RepeatWrapping;
					break;

			}

		}

		return material;

	}

};

export { VMTLoader };
