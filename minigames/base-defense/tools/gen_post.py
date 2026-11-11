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

# «Vacío»: lo pone el mod mientras hay un Dragón del End en la partida. Todo se tiñe de violeta, las sombras se
# hunden, los bordes se deforman un poco (aberración radial fuerte) y la imagen late despacio.
FSH_VOID = """#version 330

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
    float sec = GameTime * 1200.0;                 // segundos de juego
    float pulse = 0.5 + 0.5 * sin(sec * 2.2);
    // los bordes se estiran hacia fuera, como si el aire se doblara
    vec2 warp = c * r2 * (0.05 + 0.02 * pulse);
    vec2 off = c * r2 * (0.045 + 0.02 * pulse);
    vec3 col;
    col.r = texture(InSampler, uv - warp + off).r;
    col.g = texture(InSampler, uv - warp).g;
    col.b = texture(InSampler, uv - warp - off).b;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    // gradación violeta: se pierde color, las sombras van a morado oscuro y las luces a lila
    col = mix(vec3(l), col, 0.5);
    // la escena de Base Defense ya es oscura: se levantan las sombras a un morado visible (neblina), no a negro
    vec3 shadow = vec3(0.26, 0.13, 0.42);
    vec3 light = vec3(1.0, 0.86, 1.12);
    col = mix(shadow, light, smoothstep(0.0, 0.55, l)) * (0.85 + 0.7 * col);
    // lo muy brillante (orbes, rayos) florece en blanco-rosa
    float hot = smoothstep(0.72, 1.0, l);
    col += hot * vec3(0.30, 0.16, 0.34);
    col = clamp((col - 0.5) * 1.06 + 0.5, 0.0, 1.0);
    // viñeta morada que late
    float v = smoothstep(1.0, 0.22, length(c * vec2(1.0, 0.92)) * (1.22 + 0.06 * pulse));
    col = mix(vec3(0.12, 0.03, 0.22), col, mix(0.62, 1.0, v));
    float t = fract(GameTime * 1200.0);
    float g = hash(floor(uv * OutSize / 1.5) + t * vec2(97.0, 57.0)) - 0.5;
    col += g * 0.05;
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
    open(os.path.join(BD, 'shaders', 'post', 'vacio.fsh'), 'w').write(FSH_VOID)
    void = json.loads(json.dumps(EFFECT).replace('basedefense:post/apocalipsis', 'basedefense:post/vacio'))
    json.dump(void, open(os.path.join(d, 'vacio.json'), 'w'), indent=1)
    print('shader de cámara: basedefense:apocalipsis + basedefense:vacio (dragón)')


if __name__ == '__main__':
    post()
