"""Shader de cámara (pantalla completa) de Base Defense: lo activa el mod LiveArena cuando el pack del minijuego
está cargado (post_effect basedefense:apocalipsis). Grano de película, aberración cromática en los bordes,
gradación ceniza cálida con algo de contraste y viñeta. Sin el mod, el pack funciona igual (sin este efecto)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
BD = os.path.join(HERE, '..', 'src', 'pack', 'assets', 'basedefense')

FSH = """#version 330

#moj_import <minecraft:globals.glsl>

uniform sampler2D InSampler;

in vec2 texCoord;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = texCoord;
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    // aberración cromática: solo cerca de los bordes
    vec2 off = c * r2 * 0.018;
    vec3 col;
    col.r = texture(InSampler, uv + off).r;
    col.g = texture(InSampler, uv).g;
    col.b = texture(InSampler, uv - off).b;
    // gradación: algo de desaturación, tono ceniza cálido, sombras frías y curva en S
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.8);
    col *= vec3(1.05, 0.98, 0.90);
    col = mix(col, col + vec3(-0.012, 0.004, 0.02), 1.0 - smoothstep(0.0, 0.35, l));
    col = clamp((col - 0.5) * 1.08 + 0.5 + 0.015, 0.0, 1.0);
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
    // viñeta suave
    float v = smoothstep(0.95, 0.28, length(c * vec2(1.0, 0.92)) * 1.2);
    col *= mix(0.72, 1.0, v);
    // grano de película animado
    float t = fract(GameTime * 1200.0);
    float g = hash(floor(uv * OutSize / 1.5) + t * vec2(97.0, 57.0)) - 0.5;
    col += g * 0.055 * (0.6 + 0.4 * (1.0 - l));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
"""

EFFECT = {
    "targets": {"swap": {}},
    "passes": [
        {"vertex_shader": "minecraft:core/screenquad", "fragment_shader": "basedefense:post/apocalipsis",
         "inputs": [{"sampler_name": "In", "target": "minecraft:main"}], "output": "swap"},
        {"vertex_shader": "minecraft:core/screenquad", "fragment_shader": "minecraft:post/blit",
         "inputs": [{"sampler_name": "In", "target": "swap"}],
         "uniforms": {"BlitConfig": [{"name": "ColorModulate", "type": "vec4", "value": [1.0, 1.0, 1.0, 1.0]}]},
         "output": "minecraft:main"},
    ],
}


def post():
    d = os.path.join(BD, 'shaders', 'post')
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'apocalipsis.fsh'), 'w').write(FSH)
    d = os.path.join(BD, 'post_effect')
    os.makedirs(d, exist_ok=True)
    json.dump(EFFECT, open(os.path.join(d, 'apocalipsis.json'), 'w'), indent=1)
    print('shader de cámara: basedefense:apocalipsis')


if __name__ == '__main__':
    post()
