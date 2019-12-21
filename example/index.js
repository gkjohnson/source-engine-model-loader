import {
	SkeletonHelper,
	WebGLRenderer,
	PerspectiveCamera,
	Scene,
	DirectionalLight,
	AmbientLight,
	Mesh,
	MeshBasicMaterial,
	DoubleSide,
	Box3,
	PlaneBufferGeometry,
	ShadowMaterial
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SourceModelLoader } from '../src/SourceModelLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Group, BoxBufferGeometry, Vector3, Quaternion, Raycaster, Vector2 } from '../../three.js/build/three.js';



// globals
var stats;
var params = {

	showSkeleton: true,
	skin: 0

};
var camera, scene, renderer, controls;
var directionalLight, ambientLight;
var skeletonHelper, model, gui;
var transformControls;
var mouse = new Vector2();
var mouseDown = new Vector2();

init();
rebuildGui();
animate();

function init() {

	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x263238 );
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
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

	// plane = new Mesh( new PlaneBufferGeometry( 10, 10 ), new MeshBasicMaterial() );
	// plane.material.map = new VTFLoader().load( '../models/Link_-_Hyrule_Warriors_IpV1rRa/materials/models/hyrulewarriors/link/equipment/balls_and_chains/ball_and_chain_lvl2.vtf' );
	// plane.material.map = new VTFLoader().load( '../models/Overwatch/Overwatch/materials/models/tfa/overwatch/torbjorn/body_d.vtf' );
	// scene.add( plane );

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
				window.group = group;
				window.transformControls = transformControls;

				skeletonHelper = new SkeletonHelper( group );
				scene.add( skeletonHelper );
				scene.add( group );
				group.rotation.x = -Math.PI / 2;
				group.traverse(c => {
					c.castShadow = true;
					c.receiveShadow = true;
				});

				const bb = new Box3();
				bb.setFromObject( group );
				bb.getCenter( controls.target );

				const ground = new Mesh( new PlaneBufferGeometry() );
				ground.material = new ShadowMaterial( { side: DoubleSide, opacity: 0.5, transparent: true } );
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
	transformControls.size = 0.5;
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

	const group = new Group();
	const mesh = new Mesh( new BoxBufferGeometry(), new MeshBasicMaterial() );
	mesh.material.opacity = 1;
	mesh.material.color.set( 0xe91e63 );
	mesh.material.transparent = true;
	mesh.material.depthTest = false;
	mesh.position.z = 0.5;
	group.add(mesh);

	const pos = new Vector3();
	const quat = new Quaternion();
	const sca = new Vector3();
	const raycaster = new Raycaster();

	function alignToBone( bone ) {

		bone.parent.matrixWorld.decompose( group.position, group.quaternion, group.scale );
		bone.matrixWorld.decompose( pos, quat, sca );
		group.lookAt( pos );
		group.scale.z = bone.position.length();
		group.scale.y = group.scale.x = 0.25;
		group.updateMatrixWorld();

	}

	return function( mousePos ) {

		if ( model ) {

			const hits = [];

			model.traverse( c => {

				if ( c.isBone && c.parent.isBone ) {

					alignToBone( c );
					raycaster.setFromCamera( mousePos, camera );

					const arr = [];
					mesh.raycast( raycaster, arr );
					arr.forEach( item => item.bone = c );
					hits.push( ...arr );
					scene.add( group );

				}

			} );

			hits.sort( ( a, b ) => a.distance - b.distance );

			if ( hits.length !== 0 && ! transformControls.dragging ) {

				alignToBone( hits[ 0 ].bone )
				group.visible = true;

			} else {

				group.visible = false;

			}

			return hits[ 0 ] ? hits[ 0 ].bone : null;

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

	if ( mouseDown.distanceTo( mouse ) < 0.001 ) {

		const hitBone = raycastBones( mouse );
		if ( hitBone ) {

			// use right click to select tip bone
			transformControls.attach( e.button === 2 ? hitBone : hitBone.parent );

		} else {

			transformControls.detach();

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

			if ( c.material ) {

				c.material = materials[ skinsTable[ params.skin ][ c.userData.materialIndex ] ];

			}

		} );

	}

	controls.update();
	renderer.render( scene, camera );

}
