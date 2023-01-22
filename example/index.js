import {
	SkeletonHelper,
	WebGLRenderer,
	PerspectiveCamera,
	Scene,
	DirectionalLight,
	HemisphereLight,
	Mesh,
	DoubleSide,
	Box3,
	PlaneBufferGeometry,
	ShadowMaterial,
	ShaderLib,
	LinearEncoding,
	Vector3,
	Raycaster,
	Vector2,
	ShaderMaterial,
	Triangle,
	PCFSoftShadowMap,
	Sphere,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SourceModelLoader } from '../src/SourceModelLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { SkinWeightMixin } from './SkinWeightsShaderMixin.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// globals
const params = {

	showSkeleton: false,
	skin: 0,
	selectParentBoneWithChildren: true,

};
const MODELS = {

	Atlas: './models/portal2/models/player/ballbot/ballbot',
	PBody: './models/portal2/models/player/eggbot/eggbot',
	Turret: './models/portal2/models/npcs/turret/turret',

	Engineer: './models/tf/models/player/engineer',
	Pyro: './models/tf/models/player/pyro',
	Spy: './models/tf/models/player/spy',
	Demoman: './models/tf/models/player/demo',
	Heavy: './models/tf/models/player/heavy',
	Medic: './models/tf/models/player/medic',
	Scout: './models/tf/models/player/scout',
	Sniper: './models/tf/models/player/sniper',
	Soldier: './models/tf/models/player/soldier',

};

let camera, scene, renderer, controls;
let directionalLight, ambientLight, ground;
let skeletonHelper, model, skeleton, gui;
let transformControls;
const mouse = new Vector2();
const mouseDown = new Vector2();
const unselectableBones = [];
let movingControls = false;

const SkinWeightShader = SkinWeightMixin( ShaderLib.phong );
const skinWeightsMaterial = new ShaderMaterial( SkinWeightShader );
skinWeightsMaterial.polygonOffset = true;
skinWeightsMaterial.polygonOffsetFactor = - 1;
skinWeightsMaterial.polygonOffsetUnits = - 1;
skinWeightsMaterial.lights = true;
skinWeightsMaterial.skinning = true;
skinWeightsMaterial.transparent = true;
skinWeightsMaterial.depthWrite = false;
skinWeightsMaterial.uniforms.skinWeightColor.value.set( 0xe91e63 );
skinWeightsMaterial.uniforms.emissive.value.set( 0xe91e63 ).multiplyScalar( 0.5 );
skinWeightsMaterial.uniforms.opacity.value = 0.75;
skinWeightsMaterial.uniforms.shininess.value = 0.01;

let loadingId = 0;


const raycastBones = ( function () {

	const raycaster = new Raycaster();
	const triangle = new Triangle();
	const baryCoord = new Vector3();
	const getFunctions = [ 'getX', 'getY', 'getZ', 'getW' ];

	return function ( mousePos, giveDirectBone = false ) {

		if ( model && ! transformControls.object ) {

			raycaster.setFromCamera( mousePos, camera );

			const res = raycaster.intersectObject( model, true );
			if ( res.length ) {

				const hit = res[ 0 ];
				const object = hit.object;
				const geometry = object.geometry;
				const face = hit.face;

				const skinWeightAttr = geometry.getAttribute( 'skinWeight' );
				const skinIndexAttr = geometry.getAttribute( 'skinIndex' );
				const positionAttr = geometry.getAttribute( 'position' );
				const weightTotals = {};

				const aIndex = face.a;
				const bIndex = face.b;
				const cIndex = face.c;

				triangle.a.fromBufferAttribute( positionAttr, aIndex );
				triangle.b.fromBufferAttribute( positionAttr, bIndex );
				triangle.c.fromBufferAttribute( positionAttr, cIndex );

				object.boneTransform( aIndex, triangle.a );
				object.boneTransform( bIndex, triangle.b );
				object.boneTransform( cIndex, triangle.c );

				triangle.a.applyMatrix4( object.matrixWorld );
				triangle.b.applyMatrix4( object.matrixWorld );
				triangle.c.applyMatrix4( object.matrixWorld );

				triangle.getBarycoord( hit.point, baryCoord );
				for ( let i = 0; i < skinIndexAttr.itemSize; i ++ ) {

					const func = getFunctions[ i ];
					const aWeightIndex = skinIndexAttr[ func ]( aIndex );
					const bWeightIndex = skinIndexAttr[ func ]( bIndex );
					const cWeightIndex = skinIndexAttr[ func ]( cIndex );
					const aWeight = skinWeightAttr[ func ]( aIndex );
					const bWeight = skinWeightAttr[ func ]( bIndex );
					const cWeight = skinWeightAttr[ func ]( cIndex );

					weightTotals[ aWeightIndex ] = weightTotals[ aWeightIndex ] || 0;
					weightTotals[ bWeightIndex ] = weightTotals[ bWeightIndex ] || 0;
					weightTotals[ cWeightIndex ] = weightTotals[ cWeightIndex ] || 0;

					weightTotals[ aWeightIndex ] += aWeight * baryCoord.x;
					weightTotals[ bWeightIndex ] += bWeight * baryCoord.y;
					weightTotals[ cWeightIndex ] += cWeight * baryCoord.z;

				}

				const sorted =
					Object
						.entries( weightTotals )
						.map( ( [ key, value ] ) => ( { weight: value, index: key } ) )
						.sort( ( a, b ) => b.weight - a.weight );

				const boneIndex = sorted[ 0 ].index;
				let bone = skeleton.bones[ boneIndex ];
				const parentIndex = skeleton.bones.findIndex( b => b === bone.parent );

				// TODO: this should check if the parent bone isn't clickable through any other means
				// then we should bump to the parent.
				if (
					params.selectParentBoneWithChildren &&
					unselectableBones.includes( parentIndex ) &&
					bone.children.length === 0 &&
					bone.parent.children.length > 1 &&
					! giveDirectBone
				) {

					bone = bone.parent;

				}

				skinWeightsMaterial.uniforms.skinWeightIndex.value = boneIndex;

				return bone;

			} else {

				if ( transformControls.object ) {

					skinWeightsMaterial.uniforms.skinWeightIndex.value = skeleton.bones.indexOf( transformControls.object );

				} else {

					skinWeightsMaterial.uniforms.skinWeightIndex.value = - 1;

				}

				return null;

			}

		}

		return null;

	};

} )();

init();
rebuildGui();
animate();

function loadModel( path ) {

	if ( model ) {

		model.traverse( c => {

			if ( c.material ) {

				c.material.dispose();
				for ( const key in c.material ) {

					if ( c.material[ key ] && c.material[ key ].isTexture ) {

						c.material[ key ].dispose();

					}

				}

			}

			if ( c.geometry ) {

				c.geometry.dispose();

			}

			if ( c.skeleton ) {

				c.skeleton.dispose();

			}

		} );
		model.parent.remove( model );
		skeletonHelper.parent.remove( skeletonHelper );

		model = null;
		skeletonHelper = null;
		skeleton = null;

	}

	params.model = path;

	loadingId ++;
	const myLoadingId = loadingId;

	console.log( new URL( path, 'https://raw.githubusercontent.com/gkjohnson/source-engine-model-loader-models/master/' ).toString() );
	new SourceModelLoader()
		.load(
			new URL( path, 'https://raw.githubusercontent.com/gkjohnson/source-engine-model-loader-models/master/' ).toString(),
			( { group, vvd, vtx, mdl } ) => {

				if ( loadingId !== myLoadingId ) return;

				window.vvd = vvd;
				window.vtx = vtx;
				window.mdl = mdl;
				window.group = group;

				group.traverse( c => {

					if ( c.isSkinnedMesh ) {

						// Find the bone indices that are unreferenced in the model
						const getFunctions = [ 'getX', 'getY', 'getZ', 'getW' ];
						const geometry = c.geometry;
						const skinWeightAttr = geometry.getAttribute( 'skinWeight' );
						const skinIndexAttr = geometry.getAttribute( 'skinIndex' );
						const weightMap = [];
						let overallTotalWeight = 0;

						for ( let i = 0, l = skinWeightAttr.count; i < l; i ++ ) {

							let maxWeight = 0;
							let maxIndex = - 1;
							for ( let j = 0, jl = skinIndexAttr.itemSize; j < jl; j ++ ) {

								const func = getFunctions[ j ];
								const weightIndex = skinIndexAttr[ func ]( i );
								const weight = skinWeightAttr[ func ]( i );
								if ( weight > maxWeight ) {

									maxWeight = weight;
									maxIndex = weightIndex;

								}

							}

							let weightInfo = weightMap[ maxIndex ];
							if ( ! weightInfo ) {

								weightInfo = { totalCount: 0, totalWeight: 0 };
								weightMap[ maxIndex ] = weightInfo;

							}

							weightInfo.totalCount ++;
							weightInfo.totalWeight += maxWeight;
							overallTotalWeight += maxWeight;

						}

						const mappedWeights = weightMap.map( info => info ? info.totalWeight / overallTotalWeight : 0 );
						for ( let i = 0; i < mappedWeights.length; i ++ ) {

							if ( ! mappedWeights[ i ] ) {

								unselectableBones.push( i );

							}

						}

					}

				} );

				skeletonHelper = new SkeletonHelper( group );
				scene.add( skeletonHelper );
				scene.add( group );
				group.traverse( c => {

					if ( c.isMesh ) {

						c.castShadow = true;
						c.receiveShadow = true;

					}

					if ( c.isSkinnedMesh ) {

						skeleton = c.skeleton;

					}

				} );

				const bb = new Box3();
				bb.setFromObject( group );

				const sphere = new Sphere();
				bb.getBoundingSphere( sphere );

				group.scale.multiplyScalar( 20 / sphere.radius );
				const dim = new Vector3().subVectors( bb.max, bb.min );
				if ( dim.z > dim.y ) {

					group.rotation.x = - Math.PI / 2;

				}

				bb.setFromObject( group ).getCenter( group.position ).multiplyScalar( - 1 );
				bb.setFromObject( group );

				bb.getCenter( directionalLight.position );
				directionalLight.position.x += 20;
				directionalLight.position.y += 30;
				directionalLight.position.z += 20;

				ground.position.y = bb.min.y;

				const cam = directionalLight.shadow.camera;
				cam.left = cam.bottom = - 20;
				cam.right = cam.top = 20;
				cam.updateProjectionMatrix();

				// Expand the bounding volumes by a ton so that parts can't be dragged outside the
				// raycast volume.
				group.traverse( c => {

					if ( c.isSkinnedMesh ) {

						if ( ! c.geometry.boundingBox ) c.geometry.computeBoundingBox();
						c.geometry.boundingBox.min.multiplyScalar( 1000 );
						c.geometry.boundingBox.max.multiplyScalar( 1000 );

						if ( ! c.geometry.boundingSphere ) c.geometry.computeBoundingSphere();
						c.geometry.boundingSphere.radius *= 1000;

					}

				} );

				model = group;
				rebuildGui();

			} );

}

function init() {

	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x0d1113 );
	renderer.outputEncoding = LinearEncoding;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	document.body.appendChild( renderer.domElement );

	// initialize renderer, scene, camera
	camera = new PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 6000 );
	camera.position.set( 20, 20, 60 );

	scene = new Scene();

	directionalLight = new DirectionalLight( 0xFFF8E1, 1.0 );
	directionalLight.position.set( 1, 3, - 2 ).multiplyScalar( 100 );
	directionalLight.castShadow = true;
	directionalLight.shadow.mapSize.setScalar( 1024 );

	const dlShadowCam = directionalLight.shadow.camera;
	dlShadowCam.left = dlShadowCam.bottom = - 100;
	dlShadowCam.top = dlShadowCam.right = 100;
	scene.add( directionalLight );

	ambientLight = new HemisphereLight( 0xE0F7FA, 0x8D6E63, 0.45 );
	scene.add( ambientLight );

	ground = new Mesh( new PlaneBufferGeometry() );
	ground.material = new ShadowMaterial( { side: DoubleSide, opacity: 0.5, transparent: true, depthWrite: false } );
	ground.receiveShadow = true;
	ground.scale.multiplyScalar( 1000 );
	ground.rotation.x = - Math.PI / 2;
	scene.add( ground );

	loadModel( MODELS[ 'Pyro' ] );

	// camera controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.addEventListener( 'start', () => movingControls = true );
	controls.addEventListener( 'end', () => movingControls = false );
	controls.minDistance = 5;
	controls.maxDistance = 3000;

	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.mode = 'rotate';
	transformControls.space = 'local';
	transformControls.size = 0.75;
	transformControls.addEventListener( 'dragging-changed', e => {

		controls.enabled = ! e.value;
		movingControls = false;

	} );
	scene.add( transformControls );

	window.addEventListener( 'resize', onWindowResize, false );
	renderer.domElement.addEventListener( 'pointermove', onMouseMove, false );
	renderer.domElement.addEventListener( 'pointerdown', onMouseDown, false );
	renderer.domElement.addEventListener( 'pointerup', onMouseUp, false );
	window.addEventListener( 'keydown', e => {

		switch ( e.key ) {

		case 'w':
			transformControls.mode = 'translate';
			break;
		case 'e':
			transformControls.mode = 'rotate';
			break;
		case 'r':
			transformControls.mode = 'scale';
			break;

		}

	} );

}

function rebuildGui() {

	if ( gui ) {

		gui.destroy();

	}

	params.skin = 0;

	// dat gui
	gui = new GUI();
	gui.width = 400;

	gui.add( params, 'model', MODELS ).onChange( loadModel );

	gui.add( params, 'showSkeleton' );
	gui.add( params, 'selectParentBoneWithChildren' );

	if ( model ) {

		const options = {};
		model.userData.skinsTable.forEach( ( arr, i ) => {

			options[ `skin ${ i }` ] = i;

		} );

		gui.add( params, 'skin' ).options( options );

	}

	gui.open();

}

function onWindowResize() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

}

function onMouseMove( event ) {

	mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;

}

function onMouseDown() {

	mouseDown.copy( mouse );

}

function onMouseUp( e ) {

	if ( mouseDown.distanceTo( mouse ) < 0.001 ) {

		const hitBone = raycastBones( mouse, e.which !== 1 );
		if ( hitBone ) {

			// use right click to select tip bone
			transformControls.attach( hitBone );

		} else {

			transformControls.detach();
			raycastBones( mouse );

		}

	}

}

function animate() {

	requestAnimationFrame( animate );
	render();

}

function render() {

	if ( skeletonHelper ) {

		skeletonHelper.visible = params.showSkeleton;

	}

	if ( model ) {

		const skinsTable = model.userData.skinsTable;
		const materials = model.userData.materials;
		model.traverse( c => {

			if ( c.isMesh ) {

				c.material = materials[ skinsTable[ params.skin ][ c.userData.materialIndex ] ];

			}

		} );

	}

	controls.update();
	renderer.render( scene, camera );

	if ( ! movingControls && raycastBones ) {

		raycastBones( mouse );

	}

	if ( model ) {

		model.traverse( c => {

			if ( c.isMesh ) {

				c.material = skinWeightsMaterial;

			}

		} );

		renderer.autoClear = false;
		renderer.render( scene, camera );
		renderer.autoClear = true;

	}

}
