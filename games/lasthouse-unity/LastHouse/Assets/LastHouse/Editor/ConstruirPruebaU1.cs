using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace LastHouse.EditorTools
{
    /// <summary>
    /// Construye la escena de la prueba visual (U1) desde cero a partir de los FBX de tools/blender.
    /// Menú: LAST HOUSE → Construir prueba U1. Se puede volver a ejecutar: rehace escena, controladores y prefabs.
    /// </summary>
    public static class ConstruirPruebaU1
    {
        const string Raiz = "Assets/LastHouse";
        const string Escena = Raiz + "/Escenas/PruebaU1.unity";
        static readonly string[] Bucles = { "Andar", "Reposo" };

        [MenuItem("LAST HOUSE/Construir prueba U1")]
        public static string Construir()
        {
            Directory.CreateDirectory(Raiz + "/Escenas");
            Directory.CreateDirectory(Raiz + "/Animacion");
            Directory.CreateDirectory(Raiz + "/Materiales");
            Directory.CreateDirectory(Raiz + "/Prefabs");
            Clips(Raiz + "/Modelos/Zombi.fbx");
            Clips(Raiz + "/Modelos/Lanzabrotes.fbx");
            Ejes(Raiz + "/Modelos/Escenario.fbx");
            var cz = Controlador("Zombi", "Andar", ("Atacar", "Andar"), ("Dano", "Andar"));
            var cp = Controlador("Lanzabrotes", "Reposo", ("Disparar", "Reposo"), ("Dano", "Reposo"));
            Calidad();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Luces();
            Jardin();

            // Lanzabrotes en su casilla, mirando hacia los zombis (+Z)
            var planta = Instanciar(Raiz + "/Modelos/Lanzabrotes.fbx", new Vector3(0, 0.05f, 2.2f), 0);
            planta.name = "Lanzabrotes";
            var ap = Animador(planta, cp);
            var boca = new GameObject("Boca").transform;
            boca.SetParent(planta.transform, false);
            boca.localPosition = new Vector3(0, 1.0f, 0);
            // vecinos de adorno en otros carriles
            for (int i = 0; i < 2; i++)
            {
                var v = Instanciar(Raiz + "/Modelos/Lanzabrotes.fbx", new Vector3(i == 0 ? -2 : 2, 0.05f, 2.2f + i), 0);
                Animador(v, cp).Play("Reposo", 0, i * 0.4f);
            }

            // el modelo va dentro de un padre vacío: así girar el prefab no pisa la corrección de ejes del FBX
            var zombi = new GameObject("Zombi");
            var modelo = Instanciar(Raiz + "/Modelos/Zombi.fbx", Vector3.zero, 0);
            modelo.transform.SetParent(zombi.transform, false);
            Animador(modelo, cz);
            var prefab = PrefabUtility.SaveAsPrefabAsset(zombi, Raiz + "/Prefabs/Zombi.prefab");
            Object.DestroyImmediate(zombi);

            var demo = new GameObject("Demo").AddComponent<DemoCarril>();
            demo.zombiPrefab = prefab;
            demo.planta = ap;
            demo.bocaPlanta = boca;
            demo.brillo = Mat("Brote", new Color(0.55f, 0.95f, 0.3f), 0.3f, new Color(0.5f, 1.4f, 0.2f));
            demo.chispa = Particula();

            Camara();
            EditorSceneManager.SaveScene(scene, Escena);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(Escena, true) };
            return "ok " + Escena;
        }

        // ---------- animación ----------
        static void Clips(string path)
        {
            var mi = (ModelImporter)AssetImporter.GetAtPath(path);
            mi.animationType = ModelImporterAnimationType.Generic;
            mi.bakeAxisConversion = false; // con huesos, la conversión horneada tumba las piezas pegadas a huesos
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            var clips = mi.defaultClipAnimations.Select(c =>
            {
                c.name = c.name.Contains("|") ? c.name.Substring(c.name.IndexOf('|') + 1) : c.name;
                c.loopTime = Bucles.Contains(c.name);
                return c;
            }).ToArray();
            mi.clipAnimations = clips;
            mi.SaveAndReimport();
        }

        /// <summary>Blender es Z-arriba: se convierte en la importación para que cada pieza llegue de pie.</summary>
        static void Ejes(string path)
        {
            var mi = (ModelImporter)AssetImporter.GetAtPath(path);
            mi.bakeAxisConversion = true;
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            mi.SaveAndReimport();
        }

        static AnimatorController Controlador(string nombre, string inicial, params (string de, string a)[] vuelta)
        {
            var path = $"{Raiz}/Animacion/{nombre}.controller";
            AssetDatabase.DeleteAsset(path);
            var ac = AnimatorController.CreateAnimatorControllerAtPath(path);
            var sm = ac.layers[0].stateMachine;
            var clips = AssetDatabase.LoadAllAssetsAtPath($"{Raiz}/Modelos/{nombre}.fbx").OfType<AnimationClip>().Where(c => !c.name.StartsWith("__"));
            foreach (var c in clips)
            {
                var s = sm.AddState(c.name);
                s.motion = c;
                if (c.name == inicial) sm.defaultState = s;
            }
            foreach (var (de, a) in vuelta)
            {
                var s = sm.states.First(x => x.state.name == de).state;
                var t = s.AddTransition(sm.states.First(x => x.state.name == a).state);
                t.hasExitTime = true; t.exitTime = 0.9f; t.duration = 0.15f;
            }
            return ac;
        }

        static Animator Animador(GameObject go, RuntimeAnimatorController c)
        {
            var a = go.GetComponent<Animator>();
            if (a == null) a = go.AddComponent<Animator>();
            a.runtimeAnimatorController = c;
            return a;
        }

        // ---------- escena ----------
        static GameObject Instanciar(string path, Vector3 pos, float yaw, string hijo = null)
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            GameObject go;
            if (hijo == null) go = (GameObject)PrefabUtility.InstantiatePrefab(asset);
            else
            {
                go = Object.Instantiate(asset.transform.Find(hijo).gameObject);
                go.name = hijo;
            }
            go.transform.SetPositionAndRotation(pos, Quaternion.Euler(0, yaw, 0) * (hijo == null ? asset.transform.localRotation : asset.transform.Find(hijo).localRotation));
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                var ms = r.sharedMaterials;
                for (int i = 0; i < ms.Length; i++)
                    if (ms[i] != null && (ms[i].name.StartsWith("Esc_luz") || ms[i].name.StartsWith("Esc_cristal")))
                        ms[i] = ms[i].name.StartsWith("Esc_luz") ? Mat("Luz", Hex("#FFE2A0"), 0.3f, Hex("#FFC566") * 4f) : Mat("Ventana", Hex("#FFD58A"), 0.2f, Hex("#FFB84D") * 1.6f);
                r.sharedMaterials = ms;
            }
            foreach (var r in go.GetComponentsInChildren<Renderer>()) r.shadowCastingMode = ShadowCastingMode.On;
            return go;
        }

        static void Jardin()
        {
            var raiz = new GameObject("Jardin").transform;
            var verde1 = Mat("Cesped1", Hex("#7CC24A"), 0.85f);
            var verde2 = Mat("Cesped2", Hex("#68AE3C"), 0.85f);
            var borde = Mat("CespedBorde", Hex("#4E8F35"), 0.9f);
            var tierra = Mat("Tierra", Hex("#B98A5A"), 0.95f);
            // casillas a cuadros: 5 carriles × 24 filas
            for (int x = -2; x <= 2; x++)
                for (int z = 0; z < 24; z++)
                {
                    var c = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    Object.DestroyImmediate(c.GetComponent<Collider>());
                    c.transform.SetParent(raiz);
                    c.transform.position = new Vector3(x, -0.05f, z);
                    c.transform.localScale = new Vector3(1, 0.1f, 1);
                    c.GetComponent<Renderer>().sharedMaterial = (x + z) % 2 == 0 ? verde1 : verde2;
                    c.isStatic = true;
                }
            var suelo = GameObject.CreatePrimitive(PrimitiveType.Plane);
            suelo.transform.SetParent(raiz);
            suelo.transform.position = new Vector3(0, -0.09f, 10);
            suelo.transform.localScale = new Vector3(8, 1, 6);
            suelo.GetComponent<Renderer>().sharedMaterial = borde;
            foreach (var x in new[] { -2.9f, 2.9f })
            {
                var senda = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.DestroyImmediate(senda.GetComponent<Collider>());
                senda.transform.SetParent(raiz);
                senda.transform.position = new Vector3(x, -0.06f, 11);
                senda.transform.localScale = new Vector3(0.7f, 0.1f, 26);
                senda.GetComponent<Renderer>().sharedMaterial = tierra;
            }

            const string E = Raiz + "/Modelos/Escenario.fbx";
            Instanciar(E, new Vector3(0, 0, -3.2f), 180, "Casa").transform.SetParent(raiz);
            var rnd = new System.Random(11);
            float R(float a, float b) => a + (float)rnd.NextDouble() * (b - a);
            for (int z = 0; z < 24; z += 2)
                foreach (var s in new[] { -1, 1 })
                {
                    var v = Instanciar(E, new Vector3(3.5f * s, 0, z + 1), 90, z == 10 && s > 0 ? "VallaRota" : "Valla");
                    v.transform.SetParent(raiz);
                    if (z % 6 == 4) Instanciar(E, new Vector3(3.5f * s, 0, z + 0.05f), 0, "Farola").transform.SetParent(raiz);
                    var seto = Instanciar(E, new Vector3(4.6f * s + R(-0.2f, 0.2f), 0, z + R(0, 1.6f)), R(0, 360), "Seto" + rnd.Next(3));
                    seto.transform.localScale *= R(0.8f, 1.2f);
                    seto.transform.SetParent(raiz);
                    var fl = Instanciar(E, new Vector3(3.95f * s, 0, z + R(0.2f, 1.8f)), R(0, 360), "Flores" + rnd.Next(4));
                    fl.transform.localScale *= R(1.2f, 1.8f);
                    fl.transform.SetParent(raiz);
                }
            string[] arboles = { "Arbol", "ArbolRosa", "Pino", "Arbol" };
            for (int i = 0; i < 12; i++)
            {
                float s = i % 2 == 0 ? -1 : 1;
                var a = Instanciar(E, new Vector3(s * R(6.2f, 9f), 0, i * 2.3f + R(-0.5f, 0.5f)), R(0, 360), arboles[rnd.Next(arboles.Length)]);
                a.transform.localScale *= R(0.8f, 1.25f);
                a.transform.SetParent(raiz);
            }
            Instanciar(E, new Vector3(-3.0f, 0, 6.3f), 20, "Roca0").transform.SetParent(raiz);
            Instanciar(E, new Vector3(3.1f, 0, 15.6f), 70, "Roca1").transform.SetParent(raiz);
            Instanciar(E, new Vector3(-4.2f, 0, 1.0f), 15, "Caja").transform.SetParent(raiz);
            Instanciar(E, new Vector3(4.1f, 0, 21.0f), 160, "Cartel").transform.SetParent(raiz);
        }

        static void Luces()
        {
            // sol bajo y cálido de atardecer con sombras suaves
            var sol = new GameObject("Sol").AddComponent<Light>();
            sol.type = LightType.Directional;
            sol.color = Hex("#FFD7A8");
            sol.intensity = 1.6f;
            sol.shadows = LightShadows.Soft;
            sol.shadowStrength = 0.75f;
            sol.transform.rotation = Quaternion.Euler(32, -38, 0);
            // contraluz fría que separa a los personajes del fondo
            var contra = new GameObject("Contraluz").AddComponent<Light>();
            contra.type = LightType.Directional;
            contra.color = Hex("#9DB8FF");
            contra.intensity = 0.55f;
            contra.shadows = LightShadows.None;
            contra.transform.rotation = Quaternion.Euler(25, 150, 0);
            var cielo = new Material(Shader.Find("Skybox/Procedural"));
            cielo.SetColor("_SkyTint", Hex("#7FA6E8"));
            cielo.SetColor("_GroundColor", Hex("#6E8F4A"));
            cielo.SetFloat("_AtmosphereThickness", 1.25f);
            cielo.SetFloat("_Exposure", 1.15f);
            cielo.SetFloat("_SunSize", 0.06f);
            AssetDatabase.DeleteAsset(Raiz + "/Materiales/Cielo.mat");
            AssetDatabase.CreateAsset(cielo, Raiz + "/Materiales/Cielo.mat");
            RenderSettings.skybox = cielo;
            RenderSettings.sun = sol;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Hex("#8FA8E0");
            RenderSettings.ambientEquatorColor = Hex("#E8B58A");
            RenderSettings.ambientGroundColor = Hex("#4F6B36");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = Hex("#E9B98F");
            RenderSettings.fogStartDistance = 22;
            RenderSettings.fogEndDistance = 60;

            // posproceso: bloom, ACES, color más vivo, viñeta
            var vol = new GameObject("Posproceso").AddComponent<Volume>();
            vol.isGlobal = true;
            var path = Raiz + "/Materiales/PosprocesoU1.asset";
            AssetDatabase.DeleteAsset(path);
            var p = ScriptableObject.CreateInstance<VolumeProfile>();
            AssetDatabase.CreateAsset(p, path);
            var b = p.Add<Bloom>(true); b.intensity.Override(0.9f); b.threshold.Override(0.95f); b.scatter.Override(0.6f);
            p.Add<Tonemapping>(true).mode.Override(TonemappingMode.ACES);
            var ca = p.Add<ColorAdjustments>(true); ca.saturation.Override(18f); ca.postExposure.Override(0.35f); ca.contrast.Override(8f);
            var wb = p.Add<WhiteBalance>(true); wb.temperature.Override(8f);
            var vg = p.Add<Vignette>(true); vg.intensity.Override(0.22f); vg.smoothness.Override(0.5f);
            foreach (var c in p.components) AssetDatabase.AddObjectToAsset(c, p);
            EditorUtility.SetDirty(p);
            vol.sharedProfile = p;
        }

        static void Camara()
        {
            var cam = new GameObject("Camara").AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.fieldOfView = 38;
            cam.transform.position = new Vector3(7.5f, 6.2f, 16.5f);
            cam.transform.LookAt(new Vector3(0, 0.6f, 6.5f));
            cam.clearFlags = CameraClearFlags.Skybox;
            var data = cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = true;
            data.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            cam.gameObject.AddComponent<AudioListener>();
        }

        /// <summary>Sombras suaves de calidad PC y oclusión ambiental en el renderer.</summary>
        static void Calidad()
        {
            var rp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/PC_RPAsset.asset");
            if (rp == null) return;
            rp.shadowDistance = 45;
            rp.shadowCascadeCount = 2;
            rp.msaaSampleCount = 4;
            EditorUtility.SetDirty(rp);
            var rd = AssetDatabase.LoadAssetAtPath<UniversalRendererData>("Assets/Settings/PC_Renderer.asset");
            if (rd != null && !rd.rendererFeatures.Any(f => f is ScreenSpaceAmbientOcclusion))
            {
                var ao = ScriptableObject.CreateInstance<ScreenSpaceAmbientOcclusion>();
                ao.name = "OclusionAmbiental";
                AssetDatabase.AddObjectToAsset(ao, rd);
                rd.rendererFeatures.Add(ao);
                EditorUtility.SetDirty(rd);
            }
            AssetDatabase.SaveAssets();
        }

        // ---------- materiales ----------
        static Material Mat(string nombre, Color c, float rugosidad, Color? emision = null)
        {
            var path = $"{Raiz}/Materiales/{nombre}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null) { m = new Material(Shader.Find("Universal Render Pipeline/Lit")); AssetDatabase.CreateAsset(m, path); }
            m.SetColor("_BaseColor", c);
            m.SetFloat("_Smoothness", 1 - rugosidad);
            if (emision is Color e) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", e); m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive; }
            EditorUtility.SetDirty(m);
            return m;
        }

        static Material Particula()
        {
            var path = $"{Raiz}/Materiales/Chispa.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null) { m = new Material(Shader.Find("Universal Render Pipeline/Particles/Unlit")); AssetDatabase.CreateAsset(m, path); }
            m.SetFloat("_Surface", 1); m.SetFloat("_Blend", 2); // transparente, aditivo
            m.SetOverrideTag("RenderType", "Transparent");
            m.renderQueue = 3000;
            m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha); m.SetInt("_DstBlend", (int)BlendMode.One); m.SetInt("_ZWrite", 0);
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT"); m.EnableKeyword("_BLENDMODE_ADD");
            m.SetColor("_BaseColor", Color.white);
            EditorUtility.SetDirty(m);
            return m;
        }

        static Color Hex(string h) => ColorUtility.TryParseHtmlString(h, out var c) ? c : Color.magenta;

        /// <summary>Foto de la cámara principal (con posproceso) a un PNG, en el modo actual (edición o juego).</summary>
        public static string Foto(string ruta, int w = 1600, int h = 900)
        {
            var cam = Camera.main;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            tex.Apply();
            File.WriteAllBytes(ruta, tex.EncodeToPNG());
            cam.targetTexture = prev;
            RenderTexture.active = null;
            Object.DestroyImmediate(rt);
            Object.DestroyImmediate(tex);
            return ruta;
        }
    }
}
