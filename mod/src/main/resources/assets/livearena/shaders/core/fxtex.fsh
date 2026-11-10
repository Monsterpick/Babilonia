#version 330

#moj_import <minecraft:globals.glsl>

// Calco con textura (p. ej. la brújula en el suelo): se revela desde el centro con un frente brillante.
uniform sampler2D Sampler0;

in vec2 uv;
in vec4 col;
in vec3 col2;
in vec2 par;
flat in int mode;
flat in float seed;

out vec4 fragColor;

void main() {
    float T = GameTime * 1200.0;
    vec4 t = texture(Sampler0, uv);
    float d = length(uv - 0.5) * 2.0;
    float reveal = smoothstep(par.x + 0.03, par.x - 0.03, d);
    float front = exp(-pow((d - par.x) * 14.0, 2.0)) * step(par.x, 1.35);
    float pulse = 0.85 + 0.15 * sin(T * 6.0 - d * 9.0) + par.y * exp(-pow((d - fract(T * 0.8)) * 6.0, 2.0));
    float a = t.a * (reveal * pulse + front * 1.5) * col.a;
    vec3 c = mix(col.rgb, col2, clamp(t.r * t.r + front, 0.0, 1.0)) * (1.0 + t.r);
    fragColor = vec4(c * a, a);
    if (a < 0.004) discard;
}
