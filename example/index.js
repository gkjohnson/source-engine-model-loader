
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ValveLoader } from '../src/ValveLoader.js';

// globals
var stats;
var params = {
	useShadowVolumes: true,

	light: {
		speed: 1.0,
		distance: 15.0,
		pointLight: true,
	},

	shadows: {
		showVolume: false,
		distance: 400,
		bias: 0.01,
	},

	object: {
		display: 0,
		speed: 1.0,
	}
};
var camera, scene, renderer, controls;
var directionalLight, ambientLight;
var plane;

init();
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

	new ValveLoader()
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

				scene.add( group );
				group.rotation.x = -Math.PI / 2;
				group.traverse(c => {
					c.castShadow = true;
					c.receiveShadow = true;
				});

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

	// dat gui
	var gui = new dat.GUI();
	gui.width = 300;

	// gui.add(params, 'useShadowVolumes');

	// var lightFolder = gui.addFolder( 'light' );
	// lightFolder.add(params.light, 'pointLight');
	// lightFolder.add(params.light, 'speed', 0, 2);
	// lightFolder.add(params.light, 'distance', 0, 30);
	// lightFolder.open();

	// var shadowFolder = gui.addFolder( 'shadow' );
	// shadowFolder.add(params.shadows, 'showVolume');
	// shadowFolder.add(params.shadows, 'distance', 0, 600);
	// shadowFolder.add(params.shadows, 'bias',-0.05, 0.05);
	// shadowFolder.open();

	// var objectFolder = gui.addFolder( 'object' );
	// objectFolder.add(params.object, 'speed', 0, 2.0);
	// objectFolder.add(params.object, 'display', { 'Torus': 0, 'Dancer': 1 });
	// objectFolder.open();
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

	controls.update();
	renderer.render( scene, camera );

}
