#version 330

#moj_import <minecraft:globals.glsl>

// Esferas con textura del espacio: Tierra (día/noche/nubes), Vía Láctea y Luna.
// Imágenes: Solar System Scope (INOVE), CC BY 4.0, basadas en datos de NASA y ESO (ver CREDITOS.txt).
uniform sampler2D Sampler0;
uniform sampler2D Sampler1;

in vec2 uv;
in vec4 col;
in vec3 nrm;
in vec3 viewPos;
flat in int mode;

out vec4 fragColor;

void main() {
    float T = GameTime * 1200.0;
    vec3 n = normalize(nrm);
    vec3 sun = normalize(vec3(-0.55, 0.42, 0.72));
    vec3 v = normalize(-viewPos);
    vec3 c;
    if (mode == 0) {
        vec4 day = texture(Sampler0, uv);
        float cl = texture(Sampler0, uv + vec2(T * 0.0003, 0.0)).a;
        vec3 night = texture(Sampler1, uv).rgb;
        float l = dot(n, sun);
        float lit = smoothstep(-0.15, 0.25, l);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        vec3 dayc = day.rgb * (0.10 + 1.2 * max(l, 0.0));
        // Reflejo del sol en el océano.
        float ocean = smoothstep(0.04, 0.2, day.b - max(day.r, day.g));
        vec3 h = normalize(sun + v);
        dayc += vec3(1.0, 0.92, 0.8) * pow(max(dot(n, h), 0.0), 70.0) * ocean * 0.9 * step(0.0, l);
        // Luces de las ciudades en el lado de noche.
        vec3 nightc = night * night * 3.0 * (1.0 - cl * 0.85);
        c = mix(nightc, dayc, lit);
        c = mix(c, vec3(1.0) * (0.05 + 1.1 * max(l, 0.0)), cl * 0.92);
        // Terminador anaranjado y atmósfera en el borde.
        c += vec3(1.0, 0.45, 0.2) * exp(-pow(l / 0.08, 2.0)) * 0.18;
        c += vec3(0.3, 0.58, 1.0) * fres * (0.15 + 1.1 * lit);
    } else if (mode == 1) {
        c = texture(Sampler0, uv).rgb * col.rgb;
    } else {
        float l = dot(n, sun);
        c = texture(Sampler0, uv).rgb * (0.02 + 1.15 * max(l, 0.0));
    }
    fragColor = vec4(c, col.a);
}
