import * as THREE from 'three';
import { MDLLoader } from './MDLLoader.js';
import { VMTLoader } from './VMTLoader.js';
import { VTXLoader } from './VTXLoader.js';
import { VVDLoader } from './VVDLoader.js';

const ValveLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

ValveLoader.prototype = {

	constructor: ValveLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		function reverseInPlace( array ) {

			const halfLen = array.length / 2;
			for ( let i = 0, i2 = array.length - 1; i < halfLen; i ++, i2 -- ) {

				const tmp = array[ i ];
				array[ i ] = array[ i2 ];
				array[ i2 ] = tmp;

			}

			return array;

		}

		function toGeometryIndex( vtxBuffer, model, mesh, stripGroup, strip ) {

			const vtxDataView = new DataView( vtxBuffer );
			const indexArray = new Uint16Array( strip.numIndices );

			for ( let i = 0, l = strip.numIndices; i < l; i ++ ) {

				const index = strip.indexOffset + i;
				const index2 = vtxDataView.getUint16( stripGroup.indexDataStart + index * 2, true );
				const index3 = vtxDataView.getUint16( stripGroup.vertexDataStart + index2 * 9 + 4, true );
				const index4 = mesh.vertexoffset + index3;
				const index5 = index4 + model.vertexindex / 48;

				indexArray[ i ] = index5;

			}

			reverseInPlace( indexArray );

			return new THREE.BufferAttribute( indexArray, 1, false );

		}

		const mdlpr = new Promise( ( resolve, reject ) => {

			new MDLLoader( this.manager ).load( `${ url }.mdl`, resolve, undefined, reject );

		} );

		const vvdpr = new Promise( ( resolve, reject ) => {

			new VVDLoader( this.manager ).load( `${ url }.vvd`, resolve, undefined, reject );

		} );

		const vtxpr = new Promise( ( resolve, reject ) => {

			new VTXLoader( this.manager ).load( `${ url }.dx90.vtx`, resolve, undefined, reject );

		} );

		Promise
			.all( [ mdlpr, vvdpr, vtxpr ] )
			.then( ( [ mdl, vvd, vtx ] ) => {

				const promises = [];
				const vmtLoader = new VMTLoader( this.manager );
				const tokens = url.split( 'models' );
				tokens.pop();

				const path = tokens.join( 'models' ) + 'materials/';
				mdl.textures.forEach( t => {

					const matPromises = [];
					mdl.textureDirectories.forEach( f => {

						const vmtUrl = `${ path }${ f }${ t }.vmt`;
						const pr = new Promise( resolve => {

							vmtLoader.load( vmtUrl, material => {

								material.name = t;
								resolve( material );

							}, undefined, () => resolve( null ) );

						} );
						matPromises.push( pr );

					} );

					promises.push( Promise.all( matPromises ).then( materials => materials.filter( m => ! ! m )[ 0 ] ) );

				} );

				// TODO: Order is important here so it would be best to guarantee the order
				// in which the materials are specified
				return Promise
					.all( promises )
					.then( materials => ( { materials, mdl, vvd, vtx } ) );

			} )
			.then( ( { mdl, vvd, vtx, materials } ) => {

				if ( mdl.header.checksum !== vvd.header.checksum || mdl.header.checksum !== vtx.header.checksum ) {

					console.warn( 'ValveLoader: File checksums do not match.' );

				}

				// https://github.com/ValveSoftware/source-sdk-2013/blob/master/sp/src/utils/vrad/vradstaticprops.cpp#L1504-L1688
				if ( mdl.numbodyparts !== vtx.numBodyParts ) {

					console.warn( 'ValveLoader: Number of body parts does not match.' );

				}

				console.log(mdl.bones)

				const group = new THREE.Group();
				const bones = mdl.bones.map( b => {

					const bone = new THREE.Bone();
					bone.position.set(b.pos.x, b.pos.y, b.pos.z);
					bone.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
					return bone;

				} );

				bones.forEach( ( b, i ) => {

					const parent = mdl.bones[ i ].parent;
					if ( parent === -1 ) {

						group.add( b );

					} else {

						bones[ parent ].add( b );

					}

				} );

				const skeleton = new THREE.Skeleton( bones );
				const sm = new THREE.SkinnedMesh();
				bones.forEach( ( b, i ) => {

					if ( mdl.bones[ i ].parent === -1 ) {

						sm.add( b );

					}

				});
				sm.bind( skeleton );
				group.add( sm );
				sm.material.skinning = true;

				// TODO: Why do we need to add the skeleton helper to the scene? Why do
				// we need a fake skinnedmesh to show the skeleton? Why can't the bones be
				// added to a group?
				const sh = new THREE.SkeletonHelper( sm )
				// scene.add(sh)
				group.add( sh );

				vtx.bodyParts.forEach( ( vtxBodyPart, i ) => {

					var mdlBodyPart = mdl.bodyParts[ i ];
					if ( mdlBodyPart.nummodels !== vtxBodyPart.numModels ) {

						console.warn( 'ValveLoader: Number of models does not match.' );

					}

					vtxBodyPart.models.forEach( ( vtxModel, i2 ) => {

						var mdlModel = mdlBodyPart.models[ i2 ];
						vtxModel.lods.forEach( ( vtxLod, i3 ) => {

							if ( i3 !== 0 ) return;

							if ( mdlModel.nummeshes !== vtxLod.numMeshes ) {

								console.warn( 'ValveLoader: Number of meshes does not match.', mdlModel.nummeshes, vtxLod.numMeshes );
								return;

							}

							vtxLod.meshes.forEach( ( vtxMesh, i4 ) => {

								// TODO: Enable the ability to pick which skin family we use
								var mdlMesh = mdlModel.meshes[ i4 ];
								var skinsTable = mdl.skinsTable;
								var material = materials[ skinsTable[ 0 ][ mdlMesh.material ] ];
								material.skinning = true;

								vtxMesh.stripGroups.forEach( vtxStripGroup => {

									var obj = new THREE.Group();

									vtxStripGroup.strips.forEach( vtxStrip => {

										// if ( s.indexOffset !== 0 || s.numIndices === 0 ) return;
										// console.log( vtxStrip.flags, vtxStrip );

										var indexAttr = toGeometryIndex( vtx.buffer, mdlModel, mdlMesh, vtxStripGroup, vtxStrip );
										var geometry = new THREE.BufferGeometry();
										geometry.setIndex( indexAttr );
										geometry.addAttribute( 'position', vvd.attributes.position );
										geometry.addAttribute( 'uv', vvd.attributes.uv );
										geometry.addAttribute( 'normal', vvd.attributes.normal );
										geometry.addAttribute( 'skinWeight', vvd.attributes.skinWeight );
										geometry.addAttribute( 'skinIndex', vvd.attributes.skinIndex );

										// TODO : Winding order seems incorrect causing normals to face the wrong direction
										// the and faces to be inverted

										geometry.addGroup( vtxStrip.numIndices, vtxStrip.indexOffset, 0 );

										var mesh = new THREE.SkinnedMesh( geometry, material );
										var skeleton = new THREE.Skeleton( bones );
										mesh.bind( skeleton );

										if ( vtxStrip.flags & 2 ) mesh.drawMode = THREE.TriangleStripDrawMode;

										obj.add( mesh );

									} );

									if (obj.children.length === 1) {

										group.add( obj.children[ 0 ] );

									} else {

										group.add( obj );

									}

								} );

							} );

						} );

					} );

				} );

				onLoad( group );

			} );

	}

};

export { ValveLoader };
