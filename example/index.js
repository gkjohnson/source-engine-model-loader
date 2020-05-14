import {
	SkeletonHelper,
	WebGLRenderer,
	PerspectiveCamera,
	Scene,
	DirectionalLight,
	AmbientLight,
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
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SourceModelLoader } from '../src/SourceModelLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { SkinWeightMixin } from './SkinWeightsShaderMixin.js';


// globals
var stats;
var params = {

	showSkeleton: false,
	skin: 0

};
var camera, scene, renderer, controls;
var directionalLight, ambientLight;
var skeletonHelper, model, skeleton, gui;
var transformControls;
var mouse = new Vector2();
var mouseDown = new Vector2();

var SkinWeightShader = SkinWeightMixin( ShaderLib.phong );
var skinWeightsMaterial = new ShaderMaterial( SkinWeightShader );
skinWeightsMaterial.lights = true;
skinWeightsMaterial.skinning = true;
skinWeightsMaterial.transparent = true;
skinWeightsMaterial.depthWrite = false;
skinWeightsMaterial.uniforms.skinWeightColor.value.set( 0xe91e63 );
skinWeightsMaterial.uniforms.emissive.value.set( 0xe91e63 );
skinWeightsMaterial.uniforms.opacity.value = 0.4;
skinWeightsMaterial.uniforms.shininess.value = 0.01;

init();
rebuildGui();
animate();

function init() {

	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x263238 );
	renderer.outputEncoding = LinearEncoding;
	renderer.shadowMap.enabled = true;
	document.body.appendChild( renderer.domElement );

	// initialize renderer, scene, camera
	camera = new PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 6000 );
	camera.position.set( 60, 30, 60 );

	scene = new Scene();

	directionalLight = new DirectionalLight();
	directionalLight.position.set( 1, 3, -2 ).multiplyScalar( 100 );
	directionalLight.castShadow = true;

	var dlShadowCam = directionalLight.shadow.camera;
	dlShadowCam.left = dlShadowCam.bottom = -100;
	dlShadowCam.top = dlShadowCam.right = 100;
	scene.add( directionalLight );

	ambientLight = new AmbientLight( 0xffffff, 0.25 );
	scene.add( ambientLight );

	new SourceModelLoader()
		.load(
			'../models/shrek/models/shrekgame/shrek',
			// '../models/VTOL/models/kss/mirrorsedgecatalyst/vtol/kss_vtol',
			// '../models/NierPOD/models/cold/male/NIERPOD/NIERPOD',
			// '../models/neopolitan/models/rwby/Neopolitan/neopolitan',
			// '../models/boxing-gloves/models/grey/props/held/boxing_glove_l',
			// '../models/advanced_suits_ds2/models/deadspacesuits/isaacadvancedsuit',
			// '../models/im_822_handheld_ore_cutter_line_gun/models/deadspaceweapons/line_gun',
			// '../models/heart/models/Tahlian/Valentine/Gift/gift',
			// '../models/Link_-_Hyrule_Warriors_IpV1rRa/models/hyrulewarriors/link_classic',
			// '../models/Link_-_Hyrule_Warriors_IpV1rRa/models/hyrulewarriors/link_ball_and_chain_lvl3',
			// '../models/earthgovgunship_ds2_sfm/models/_maz_ter_/deadspace/deadspacescenery/earthgovgunship',
			// '../models/MGSBox/models/Cytreath/Models/mgsbox',
			// '../models/polanball/models/mrpounder/polanball/countryball',
			// '../models/studio_backdrop_sfm/models/photoshoot/background',
			// '../models/elderwand/models/hbn/harrypotter/elderwand/elderwand',
			// '../models/bioshock/models/Sr-Zodiac/bioshock2/eleanorlamb/eleanor_lamb',


			// '../models/Overwatch/Overwatch/models/overwatch/characters/hanzo_default',
			// '../models/Overwatch/Overwatch/models/overwatch/characters/torbjorn_default',


			group => {
				skeletonHelper = new SkeletonHelper( group );
				scene.add( skeletonHelper );
				scene.add( group );
				group.rotation.x = -Math.PI / 2;
				group.traverse(c => {

					if (c.isMesh) {
						c.castShadow = true;
						c.receiveShadow = true;
					}

					if (c.isSkinnedMesh) {
						skeleton = c.skeleton;
					}

				});

				const bb = new Box3();
				bb.setFromObject( group );
				bb.getCenter( controls.target );

				const ground = new Mesh( new PlaneBufferGeometry() );
				ground.material = new ShadowMaterial( { side: DoubleSide, opacity: 0.5, transparent: true, depthWrite: false } );
				ground.receiveShadow = true;
				ground.scale.multiplyScalar( 1000 );
				ground.rotation.x = -Math.PI / 2;
				ground.position.y = bb.min.y;
				scene.add( ground );

				const box = new Box3();
				box.setFromObject( group );

				box.getCenter( directionalLight.position );
				directionalLight.position.x += 20;
				directionalLight.position.y += 30;
				directionalLight.position.z += 20;

				const dim = Math.max(
					box.max.x - box.min.x,
					box.max.y - box.min.y,
					box.max.z - box.min.z,
				);

				const cam = directionalLight.shadow.camera
				cam.left = cam.bottom = - dim / 2;
				cam.right = cam.top = dim / 2;
				cam.updateProjectionMatrix();

				model = group;
				rebuildGui();

			} );

	// stats
	stats = new Stats();
	document.body.appendChild( stats.dom );

	// camera controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 5;
	controls.maxDistance = 3000;

	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.mode = 'rotate';
	transformControls.space = 'local';
	transformControls.size = 1;
	transformControls.addEventListener( 'dragging-changed', e => controls.enabled = ! e.value );
	scene.add( transformControls );

	window.addEventListener( 'resize', onWindowResize, false );
	renderer.domElement.addEventListener( 'mousemove', onMouseMove, false );
	renderer.domElement.addEventListener( 'mousedown', onMouseDown, false );
	renderer.domElement.addEventListener( 'mouseup', onMouseUp, false );
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

	});

}

function rebuildGui() {

	if ( gui ) {

		gui.destroy();

	}

	params.skin = 0;

	// dat gui
	gui = new dat.GUI();
	gui.width = 300;

	gui.add( params, 'showSkeleton' );

	if ( model ) {

		const options = {};
		model.userData.skinsTable.forEach( ( arr, i ) => {

			options[ `skin ${ i }` ] = i;

		});

		gui.add( params, 'skin' ).options( options );

	}

	gui.open();

}

function onWindowResize() {

	var width = window.innerWidth;
	var height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

}

const raycastBones = ( function() {

	const raycaster = new Raycaster();
	const triangle = new Triangle();
	const baryCoord = new Vector3();
	const getFunctions = [ 'getX', 'getY', 'getZ', 'getW' ];

	return function( mousePos ) {

		if ( model ) {

			raycaster.setFromCamera( mousePos, camera );

			const res = raycaster.intersectObject( model, true );
			if ( res.length ) {

				const hit = res[ 0 ];
				const object = hit.object;
				const geometry = object.geometry;
				const face = hit.face;

				const skinWeightAttr = geometry.getAttribute( 'skinWeight' );
				const skinIndexAttr = geometry.getAttribute( 'skinIndex' );
				const weightTotals = {};

				const aIndex = face.a;
				const bIndex = face.b;
				const cIndex = face.c;

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
				const bone = skeleton.bones[ boneIndex ];

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

	}

} )();

function onMouseMove( event ) {

	mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;
	raycastBones( mouse );

}

function onMouseDown() {

	mouseDown.copy( mouse );

}

function onMouseUp( e ) {

	window.transformControls = transformControls
	if ( mouseDown.distanceTo( mouse ) < 0.001 ) {

		const hitBone = raycastBones( mouse );
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

	stats.update();
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
