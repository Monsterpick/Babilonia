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
