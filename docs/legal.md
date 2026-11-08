# Consideraciones legales y de plataforma

## API no oficial de TikTok
- La conexión al live usa [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector), una librería **no oficial** basada en ingeniería inversa. La firma de la conexión la hace **Euler Stream** (servicio externo; el plan gratuito tiene un límite bajo, con API key propia sube).
- Puede romperse en cualquier momento si TikTok cambia su sistema. Por eso está aislada en `packages/source-tiktok`: si falla, el resto de la app (simulador, Minecraft, overlays) sigue funcionando y se puede cambiar de proveedor implementando la interfaz `LiveSource`.
- La app **solo lee** eventos públicos del live. No inicia sesión con tu cuenta, no publica, no comenta ni hace nada en tu nombre. Ninguna clave (API key de Euler, contraseña RCON) va en el código: se guardan en `.env` o en `~/.livearena/config.json` (solo tu usuario puede leerlo) y nunca se exportan en los códigos de perfil.

## Políticas de TikTok LIVE
Revisa siempre la versión vigente de las **Normas de la comunidad**, las **Directrices de monetización de LIVE** y la **Política de regalos** de TikTok antes de emitir. Puntos a tener en cuenta con contenido interactivo:
- **Nada de apuestas ni juegos de azar** ligados a regalos, ni sorteos de premios con valor real a cambio de regalos. Las acciones aleatorias de LiveArena solo afectan al juego.
- **No prometas recompensas fuera de la plataforma** (dinero, artículos, cuentas) a cambio de regalos.
- **No pidas regalos de forma engañosa o insistente**; el juego debe ser divertido aunque nadie regale.
- El contenido del juego debe cumplir las normas (violencia, sustos, contenido para menores).
- El live debe seguir siendo contenido original y en directo, con el streamer presente: no lo dejes como una emisión automática desatendida.

## Minecraft
- El **EULA de Minecraft** (https://aka.ms/MinecraftEULA) lo acepta el usuario explícitamente al crear un servidor; la app nunca lo acepta por ti.
- Revisa las directrices de uso de marca y de servidores de Mojang si vas a monetizar.

## Assets
- Las imágenes de regalos son de TikTok y se usan solo para identificar los regalos en tu propio live y panel, igual que las que entrega el conector en vivo.
- No uses marcas, logos ni assets de otras herramientas (TikFinity, MineLive, AsureLive, etc.).
