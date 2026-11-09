"""Valida un modelo de Blockbench contra el contrato del kit y (con --instalar) lo copia al mod.

Uso:
  python3 validar_modelo.py <nombre> [carpeta]            # por defecto modelos_entrada/<nombre>/
  python3 validar_modelo.py <nombre> [carpeta] --instalar  # además lo copia a src/main/resources/assets/livearena

Comprueba: que los JSON se leen, que están los huesos y animaciones del contrato (acepta el prefijo
«animation.<nombre>.» que pone Blockbench), que hay textura .png y el tamaño de textura declarado.
"""
import json, os, shutil, sys

CONTRATO = {
    'goku': (['cabeza', 'brazo_izquierdo', 'brazo_derecho', 'manos'], ['aparicion', 'alzar_brazos', 'lanzar', 'pose_final']),
    'sukuna': (['cabeza', 'manos', 'brazo_derecho'], ['aparicion', 'sello_mano', 'idle_dominio', 'corte_final', 'desaparicion']),
    'santuario': (['base', 'fauces'], ['emerger', 'idle', 'hundirse']),
    'gojo': (['cabeza', 'mano_izquierda', 'mano_derecha', 'mano_proyectil'], ['aparicion', 'carga', 'disparo', 'pose_final']),
    'akaza': (['cabeza', 'cuerpo', 'puno_derecho'], ['aparicion', 'despliegue_tecnica', 'golpe_suelo', 'pose_final']),
}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'main', 'resources', 'assets', 'livearena')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        return 2
    name = args[0]
    folder = args[1] if len(args) > 1 else os.path.join('modelos_entrada', name)
    ok = True
    if name not in CONTRATO:
        print(f'⚠ «{name}» no está en el contrato (se valida solo el formato).')
    try:
        geo = json.load(open(os.path.join(folder, f'{name}.geo.json'), encoding='utf-8'))
        ani = json.load(open(os.path.join(folder, f'{name}.animation.json'), encoding='utf-8'))
    except (OSError, ValueError) as e:
        print('✖ No se pudo leer el modelo:', e)
        return 1
    g = geo['minecraft:geometry'][0]
    bones = {b['name'] for b in g.get('bones', [])}
    anims = set(ani.get('animations', {}).keys())
    short = {a.split('.')[-1] for a in anims}
    need_b, need_a = CONTRATO.get(name, ([], []))
    for b in need_b:
        if b not in bones:
            ok = False
            print(f'✖ Falta el hueso «{b}»')
    for a in need_a:
        if a not in anims and a not in short:
            ok = False
            print(f'✖ Falta la animación «{a}»')
    for a in sorted(anims):
        for bone in ani['animations'][a].get('bones', {}):
            if bone not in bones:
                print(f'⚠ La animación «{a}» mueve el hueso «{bone}», que no existe en el modelo')
    png = os.path.join(folder, f'{name}.png')
    if not os.path.exists(png):
        ok = False
        print(f'✖ Falta la textura {name}.png')
    tw, th = g['description'].get('texture_width'), g['description'].get('texture_height')
    print(f'Huesos: {len(bones)} · cubos: {sum(len(b.get("cubes", [])) for b in g["bones"])} · animaciones: {len(anims)} · textura declarada {tw}×{th}')
    if not ok:
        print('✖ El modelo no cumple el contrato.')
        return 1
    print('✔ Cumple el contrato.')
    if '--instalar' in sys.argv:
        for sub, fn in (('geckolib/models', f'{name}.geo.json'), ('geckolib/animations', f'{name}.animation.json'), ('textures/entity', f'{name}.png'), ('textures/entity', f'{name}_glowmask.png')):
            src = os.path.join(folder, fn)
            if os.path.exists(src):
                os.makedirs(os.path.join(ROOT, sub), exist_ok=True)
                shutil.copy(src, os.path.join(ROOT, sub, fn))
                print('  copiado', fn)
        print('Instalado: recompila el mod (o úsalo en un paquete de recursos con las mismas rutas).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
