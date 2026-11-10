#version 330

#moj_import <minecraft:dynamictransforms.glsl>
#moj_import <minecraft:projection.glsl>

in vec3 Position;
in vec4 Color;
in vec2 UV0;
in ivec2 UV1;
in ivec2 UV2;
in vec3 Normal;

out vec2 uv;
out vec4 col;
out vec3 col2;
out vec2 par;
flat out int mode;
flat out float seed;

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);
    uv = UV0;
    col = Color;
    col2 = Normal * 0.5 + 0.5;
    mode = UV1.x;
    seed = float(UV1.y);
    par = vec2(UV2) / 1000.0;
}
