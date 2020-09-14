import { Color, UniformsUtils } from 'three';

function cloneShader(shader, uniforms, defines) {

	const newShader = Object.assign({}, shader);
	newShader.uniforms = UniformsUtils.merge([
		newShader.uniforms,
		uniforms
	]);
	newShader.defines = Object.assign({}, defines);

	return newShader;

}

export function SkinWeightMixin(shader) {
	const defineKeyword = 'ENABLE_SKIN_WEIGHTS';
	const newShader = cloneShader(
		shader,
		{
			skinWeightColor: { value: new Color() },
			skinWeightOpacity: { value: 1.0 },
			skinWeightIndex: { value: - 1 }
		},
		{
			[defineKeyword]: 1,
		},
	);

	newShader.vertexShader = `
		uniform float skinWeightIndex;
		varying float skinWeightColorRatio;
		${newShader.vertexShader}
	`.replace(
		/#include <skinning_vertex>/,
		v => `${v}
		{
			#ifdef ENABLE_SKIN_WEIGHTS
				skinWeightColorRatio += skinWeight.x * float(skinIndex.x == skinWeightIndex);
				skinWeightColorRatio += skinWeight.y * float(skinIndex.y == skinWeightIndex);
				skinWeightColorRatio += skinWeight.z * float(skinIndex.z == skinWeightIndex);
				skinWeightColorRatio += skinWeight.w * float(skinIndex.w == skinWeightIndex);
			#endif
		}
		`
	)

	newShader.fragmentShader = `
			uniform vec3 skinWeightColor;
			varying float skinWeightColorRatio;
			${newShader.fragmentShader}
		`.replace(
			/vec4 diffuseColor = vec4\( diffuse, opacity \);/,
			v => `${v}
			#ifdef ENABLE_SKIN_WEIGHTS
				diffuseColor = vec4( skinWeightColor, smoothstep( 0.1, 0.3, skinWeightColorRatio ) * opacity );
			#endif
			`,
		);

	return newShader;
}
