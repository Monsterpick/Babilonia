#version 330

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
