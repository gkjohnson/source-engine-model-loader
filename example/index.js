
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SourceModelLoader } from '../src/SourceModelLoader.js';
import { SkeletonHelper } from 'three';

// globals
var stats;
var params = {

	showSkeleton: true,
	skin: 0

};
var camera, scene, renderer, controls;
var directionalLight, ambientLight;
var skeletonHelper, model, gui;

init();
rebuildGui();
animate();

function init() {

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x263238 );
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.shadowMap.enabled = true;
	document.body.appendChild( renderer.domElement );

	// initialize renderer, scene, camera
	camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 6000 );
	camera.position.set( 60, 30, 60 );

	scene = new THREE.Scene();

	directionalLight = new THREE.DirectionalLight();
	directionalLight.position.set( 1, 3, -2 ).multiplyScalar( 100 );
	directionalLight.castShadow = true;

	var dlShadowCam = directionalLight.shadow.camera;
	dlShadowCam.left = dlShadowCam.bottom = -100;
	dlShadowCam.top = dlShadowCam.right = 100;
	scene.add( directionalLight );

	ambientLight = new THREE.AmbientLight( 0xffffff, 0.25 );
	scene.add( ambientLight );

	// plane = new THREE.Mesh( new THREE.PlaneBufferGeometry( 10, 10 ), new THREE.MeshBasicMaterial() );
	// plane.material.map = new VTFLoader().load( '../models/Link_-_Hyrule_Warriors_IpV1rRa/materials/models/hyrulewarriors/link/equipment/balls_and_chains/ball_and_chain_lvl2.vtf' );
	// plane.material.map = new VTFLoader().load( '../models/Overwatch/Overwatch/materials/models/tfa/overwatch/torbjorn/body_d.vtf' );
	// scene.add( plane );

	new SourceModelLoader()
		.load(
			// '../models/shrek/models/shrekgame/shrek',
			// '../models/VTOL/models/kss/mirrorsedgecatalyst/vtol/kss_vtol',
			'../models/NierPOD/models/cold/male/NIERPOD/NIERPOD',
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
					c.castShadow = true;
					c.receiveShadow = true;
				});

				console.log( group );
				const bb = new THREE.Box3();
				bb.setFromObject( group );
				bb.getCenter( controls.target );

				const ground = new THREE.Mesh( new THREE.PlaneBufferGeometry() );
				ground.material = new THREE.ShadowMaterial( { opacity: 0.5, transparent: true } );
				ground.receiveShadow = true;
				ground.scale.multiplyScalar( 1000 );
				ground.rotation.x = -Math.PI / 2;
				ground.position.y = bb.min.y;
				scene.add( ground );

				const box = new THREE.Box3();
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

	// new THREE.MDLLoader().load( '../models/Link_-_Hyrule_Warriors_IpV1rRa/models/hyrulewarriors/link_classic.mdl', d => console.log( d ) );

	// new THREE.VVDLoader().load( '../models/Link_-_Hyrule_Warriors_IpV1rRa/models/hyrulewarriors/link_classic.vvd', d => console.log( d ) );

	// new THREE.VTXLoader().load( '../models/Link_-_Hyrule_Warriors_IpV1rRa/models/hyrulewarriors/link_classic.dx90.vtx', d => console.log( d ) );

	// stats
	stats = new Stats();
	document.body.appendChild( stats.dom );

	// camera controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 5;
	controls.maxDistance = 3000;

	window.addEventListener( 'resize', onWindowResize, false );

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
