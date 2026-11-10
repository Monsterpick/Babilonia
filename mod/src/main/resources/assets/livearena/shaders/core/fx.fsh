#version 330

#moj_import <minecraft:globals.glsl>

// Efectos de energía de LiveArena: todo se calcula aquí (ruido, plasma, halos), sin texturas.
in vec2 uv;
in vec4 col;
in vec3 col2;
in vec2 par;
flat in int mode;
flat in float seed;

out vec4 fragColor;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) {
        s += a * noise(p);
        p = p * 2.03 + vec3(1.7, 9.2, 3.1);
        a *= 0.5;
    }
    return s;
}

vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
    float T = GameTime * 1200.0;
    vec3 c = vec3(0.0);
    float a = 0.0;
    float r = length(uv);
    if (mode == 0) {
        // Esfera de plasma: uv ±2.5, radio 1. par.x = velocidad, par.y = núcleo caliente.
        float t = T * max(par.x, 0.05);
        if (r < 1.0) {
            float z = sqrt(1.0 - r * r);
            vec3 n = rotY(vec3(uv, z), t * 0.5 + seed);
            float f = fbm(n * 1.8 + vec3(0.0, -t * 0.35, seed));
            float f2 = fbm(n * 3.4 + vec3(t * 0.45, f * 2.4, -t * 0.25));
            // Filamentos finos de energía sobre un plasma oscuro que se mueve.
            float veins = smoothstep(0.05, 0.0, abs(f2 - 0.5)) * (0.55 + 0.45 * sin(T * 5.0 + f * 20.0));
            float fres = pow(1.0 - z, 2.4);
            vec3 base = mix(col.rgb * 0.06, col.rgb * 0.8, smoothstep(0.34, 0.66, f));
            c = base * (0.45 + 1.1 * smoothstep(0.3, 0.7, f2)) + mix(col.rgb, col2, 0.7) * veins * 0.9 + mix(col.rgb, vec3(1.0), 0.45) * fres * 1.25;
            c += mix(col.rgb, col2, 0.6) * pow(z, 12.0) * par.y * (0.4 + 0.12 * sin(T * 9.0 + seed));
            a = 1.0;
        }
        float edge = smoothstep(1.0, 0.985, r);
        float ang = atan(uv.y, uv.x);
        float halo = exp(-max(r - 0.96, 0.0) * 4.6);
        float rays = pow(noise(vec3(ang * 5.0, T * 1.3, seed)), 3.0) * exp(-max(r - 1.0, 0.0) * 1.7) * 1.4;
        float fade = smoothstep(2.5, 1.9, r);
        vec3 glow = (col.rgb * (halo * 0.9 + rays * 0.8) + col2 * pow(halo, 4.0) * 0.5) * fade;
#ifdef ADDITIVE
        c = c * edge + glow * mix(1.0, 0.18, edge);
        a = max(a * edge, clamp(halo + rays, 0.0, 1.0) * fade);
#else
        // Pasada opaca: solo el cuerpo de la esfera (el halo se suma aparte y no oscurece el cielo).
        a = a * edge;
#endif
    } else if (mode == 1) {
        // Destello suave / chispa. par.x = estrella (rayos en cruz).
        float g = pow(max(0.0, 1.0 - r), 2.2);
        float core = pow(max(0.0, 1.0 - r * 2.2), 2.0);
        float star = par.x * (exp(-abs(uv.y) * 46.0) * exp(-abs(uv.x) * 2.6) + exp(-abs(uv.x) * 46.0) * exp(-abs(uv.y) * 2.6));
        a = clamp(g + star, 0.0, 1.0);
        c = mix(col.rgb, col2, clamp(core + star * 0.7, 0.0, 1.0)) * (1.0 + core);
    } else if (mode == 2) {
        // Onda expansiva: anillo en r = 0.82. par.x = grosor, par.y = estela interior.
        float ang = atan(uv.y, uv.x);
        float n = fbm(vec3(ang * 4.0, r * 3.0 - T * 2.0, seed));
        float d = abs(r - 0.82 + (n - 0.5) * 0.06) / max(par.x, 0.01);
        float ring = exp(-d * d);
        float core = exp(-d * d * 9.0);
        float inner = par.y * smoothstep(0.1, 0.82, r) * step(r, 0.82) * (0.35 + 0.65 * n);
        a = clamp(ring + inner, 0.0, 1.0) * smoothstep(1.0, 0.94, r);
        c = mix(col.rgb, col2, core) * (1.0 + core * 1.5);
    } else if (mode == 3) {
        // Haz / cinta: uv.x a lo ancho (±1), uv.y a lo largo. par.x = turbulencia, par.y = velocidad.
        float n = fbm(vec3(uv.x * 2.0 + seed, uv.y * 0.9 - T * par.y, T * 0.4));
        float x = abs(uv.x) * (1.0 + (n - 0.5) * par.x);
        float core = exp(-x * x * 34.0);
        float glow = exp(-x * x * 3.2) * (0.55 + 0.75 * n);
        a = clamp(core + glow, 0.0, 1.0) * smoothstep(1.0, 0.8, abs(uv.x));
        c = mix(col.rgb, col2, core) * (1.0 + core * 1.6);
    } else if (mode == 4) {
        // Tajo: uv.x a lo largo (±1), uv.y a lo ancho (±1). par.x = avance del trazo (0..1), par.y = filo.
        float w = pow(max(0.0, 1.0 - uv.x * uv.x), 0.6);
        float d = abs(uv.y) / max(w, 0.001);
        float core = smoothstep(0.30, 0.04, d) * step(0.001, w);
        float glow = exp(-d * d * 5.0) * w;
        float head = -1.0 + 2.2 * par.x;
        float wipe = smoothstep(head, head - 0.35, uv.x);
        float tip = exp(-pow((uv.x - head + 0.12) * 5.0, 2.0)) * step(par.x, 0.98);
        a = clamp(core + glow + tip * glow, 0.0, 1.0) * wipe;
        c = mix(col.rgb, col2, clamp(core * par.y + tip, 0.0, 1.0)) * (1.0 + core);
    } else if (mode == 5) {
        // Aura de llamas: uv.x ±1, uv.y 0 (base) a 1 (punta). Silueta de llama que se estrecha y ondula.
        float y = uv.y;
        float w = mix(1.0, 0.22, pow(y, 0.75));
        float x = (uv.x + (noise(vec3(y * 3.0 - T * 2.0, seed, 0.0)) - 0.5) * 0.25 * y) / w;
        float n = fbm(vec3(uv.x * 3.0 + seed, y * 4.0 - T * 3.2, T * 0.6));
        float n2 = fbm(vec3(uv.x * 7.0 - seed, y * 8.0 - T * 5.5, 3.0));
        float body = max(0.0, 1.0 - x * x) * (1.0 - y);
        float f = (body * 1.5 + (n - 0.5) * 1.0 + (n2 - 0.5) * 0.5) * smoothstep(0.0, 0.1, y) * step(abs(x), 1.0);
        a = smoothstep(0.36, 0.95, f) * 0.8;
        c = mix(col.rgb, col2, smoothstep(0.95, 1.5, f) * 0.75);
    } else if (mode == 6) {
        // Vórtice: brazos en espiral. par.x = nº de brazos, par.y = giro.
        float ang = atan(uv.y, uv.x);
        float s = sin(ang * par.x + log(max(r, 0.02)) * 7.0 - T * par.y + seed);
        float n = fbm(vec3(uv * 3.0, T * 0.5 + seed));
        float arms = pow(0.5 + 0.5 * s, 3.0) * (0.5 + n);
        a = clamp(arms, 0.0, 1.0) * smoothstep(1.0, 0.55, r) * smoothstep(0.05, 0.3, r);
        c = mix(col.rgb, col2, arms * 0.6);
    } else if (mode == 8) {
        // Campo de estrellas (cara de una caja): estrellas de varios tamaños con titileo y nebulosa tenue.
        vec2 g = uv * 140.0;
        vec2 cell = floor(g), f = fract(g) - 0.5;
        float h = hash(vec3(cell, seed));
        float star = 0.0;
        if (h > 0.93) {
            vec2 o = vec2(hash(vec3(cell, seed + 1.0)), hash(vec3(cell, seed + 2.0))) - 0.5;
            float d = length(f - o * 0.6);
            float sz = mix(0.03, 0.14, pow(hash(vec3(cell, seed + 3.0)), 6.0));
            star = smoothstep(sz, 0.0, d) * (0.6 + 0.4 * sin(T * (2.0 + h * 5.0) + h * 40.0));
        }
        float neb = fbm(vec3(uv * 2.2, seed * 0.1));
        neb = smoothstep(0.55, 0.85, neb) * 0.35;
        c = vec3(1.0) * star + col2 * neb * 0.35 + vec3(0.01, 0.012, 0.03);
        a = 1.0;
    } else if (mode == 9) {
        // Planeta visto desde la órbita (par.x = 0: superficie; 1: solo atmósfera aditiva).
        float rr = r;
        if (par.x < 0.5) {
            if (rr > 1.0) discard;
            float z = sqrt(1.0 - rr * rr);
            vec3 n = vec3(uv, z);
            vec3 p = rotY(n, T * 0.004 + seed);
            float land = smoothstep(0.52, 0.56, fbm(p * 2.6));
            float cloud = smoothstep(0.5, 0.75, fbm(p * 5.0 + vec3(T * 0.01, 0.0, 0.0)));
            vec3 ocean = col.rgb * 0.55;
            vec3 ground = mix(vec3(0.20, 0.32, 0.14), vec3(0.55, 0.47, 0.32), fbm(p * 7.0));
            vec3 surf = mix(ocean, ground, land);
            surf = mix(surf, vec3(0.95), cloud * 0.85);
            float light = clamp(dot(n, normalize(vec3(-0.6, 0.55, 0.6))), 0.0, 1.0);
            c = surf * (0.08 + 1.1 * light) + col2 * pow(1.0 - z, 3.0) * 0.8 * (0.3 + light);
            a = 1.0;
        } else {
            float rim = exp(-pow((rr - 1.0) / 0.035, 2.0)) + smoothstep(1.0, 0.85, rr) * pow(rr, 6.0) * 0.6;
            a = clamp(rim, 0.0, 1.0) * smoothstep(1.18, 1.05, rr);
            c = mix(col.rgb, col2, 0.5) * 1.2;
        }
    } else if (mode == 10) {
        // Cúpula de energía: borde brillante (fresnel), interior rojo oscuro que hierve (par.x = 1: pasada aditiva).
        if (r > 1.0) {
            float g = exp(-(r - 1.0) * 18.0);
            a = par.x > 0.5 ? g : 0.0;
            c = col.rgb;
        } else {
            float z = sqrt(1.0 - r * r);
            vec3 n = vec3(uv, z);
            float f = fbm(n * 3.0 + vec3(0.0, -T * 0.8, seed));
            float fres = pow(1.0 - z, 3.0);
            if (par.x > 0.5) {
                a = fres * 1.2 + smoothstep(0.6, 0.8, f) * 0.25;
                c = mix(col.rgb, col2, fres);
            } else {
                a = 0.55 + 0.35 * fres;
                c = col.rgb * (0.35 + 0.6 * f) + col2;
            }
        }
    } else if (mode == 11) {
        // Punta de flecha: uv.x a lo ancho (±1), uv.y a lo largo (0 = base, 1 = punta). par.x = 1: solo el brillo.
        float y = clamp(uv.y, 0.0, 1.0);
        float w = y > 0.42 ? (1.0 - y) / 0.58 : mix(0.18, 0.62, smoothstep(0.0, 0.42, y));
        w *= 1.0 + 0.25 * smoothstep(0.30, 0.42, y) * step(y, 0.42); // aletas
        float x = abs(uv.x);
        float inside = smoothstep(w + 0.05, w - 0.03, x);
        float core = exp(-x * x / (w * w * 0.12 + 0.002)) * smoothstep(0.05, 0.5, y);
        float rim = smoothstep(w - 0.18, w - 0.02, x) * inside;
        if (par.x > 0.5) {
            a = (core * 1.2 + exp(-max(x - w, 0.0) * 9.0) * 0.35 * step(0.02, w)) * smoothstep(0.0, 0.15, y);
            c = mix(col.rgb, col2, core);
        } else {
            a = inside;
            c = mix(col.rgb, col2, core * 0.9) + col2 * rim * 0.25;
        }
    } else {
        // Color liso (núcleos oscuros, líneas).
        a = smoothstep(1.0, 0.8, r);
        c = col.rgb;
    }
    a *= col.a;
#ifdef ADDITIVE
    fragColor = vec4(c * a, a);
#else
    fragColor = vec4(c, a);
#endif
    if (a < 0.004) discard;
}
