using System.Collections.Generic;
using UnityEngine;

namespace LastHouse
{
    /// <summary>
    /// Prueba visual U1: zombis que avanzan por el carril hacia la casa y un Lanzabrotes que les lanza brotes en
    /// parábola. Sin reglas de juego todavía (llegan en U2): solo animación, impactos y efectos.
    /// </summary>
    public class DemoCarril : MonoBehaviour
    {
        public GameObject zombiPrefab;
        public Animator planta;
        public Transform bocaPlanta;
        public float inicioZ = 22f, finZ = 3.2f, velocidad = 0.9f, cadencia = 1.8f;
        public int vidaZombi = 4;
        public Material brillo, chispa;

        class Zombi { public Transform t; public Animator a; public int vida; public float muerto = -1, golpe; }
        readonly List<Zombi> zombis = new();
        float proximoDisparo = 1f, proximoZombi;

        void Update()
        {
            float t = Time.time;
            if (t > proximoZombi && zombis.Count < 3) { Aparecer(); proximoZombi = t + 4.5f; }

            Zombi blanco = null;
            foreach (var z in zombis)
            {
                if (z.muerto >= 0) continue;
                if (z.t.position.z > finZ) z.t.position += Vector3.back * (velocidad * Time.deltaTime);
                else if (t > z.golpe) { z.a.CrossFadeInFixedTime("Atacar", 0.1f); z.golpe = t + 1.4f; }
                if (blanco == null || z.t.position.z < blanco.t.position.z) blanco = z;
            }
            zombis.RemoveAll(z =>
            {
                if (z.muerto < 0 || t - z.muerto < 3f) return false;
                Destroy(z.t.gameObject);
                return true;
            });

            if (blanco != null && blanco.t.position.z < inicioZ - 1 && t > proximoDisparo)
            {
                proximoDisparo = t + cadencia;
                StartCoroutine(Disparo(blanco));
            }
        }

        void Aparecer()
        {
            var go = Instantiate(zombiPrefab, new Vector3(Random.Range(-0.25f, 0.25f), 0, inicioZ), Quaternion.Euler(0, 180, 0));
            go.transform.localScale = Vector3.one * Random.Range(0.92f, 1.08f);
            var a = go.GetComponentInChildren<Animator>();
            a.Play("Andar", 0, Random.value);
            a.speed = Random.Range(0.9f, 1.1f);
            zombis.Add(new Zombi { t = go.transform, a = a, vida = vidaZombi });
        }

        System.Collections.IEnumerator Disparo(Zombi z)
        {
            planta.CrossFadeInFixedTime("Cargar", 0.05f);
            yield return new WaitForSeconds(0.55f);
            planta.CrossFadeInFixedTime("Disparar", 0.02f);
            Flash(bocaPlanta.position, new Color(0.7f, 1f, 0.4f), 0.35f, 14);
            // brote en parábola (el Lanzabrotes es un mortero de jardín)
            var brote = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(brote.GetComponent<Collider>());
            brote.transform.localScale = Vector3.one * 0.18f;
            brote.GetComponent<Renderer>().sharedMaterial = brillo;
            var estela = brote.AddComponent<TrailRenderer>();
            estela.time = 0.25f; estela.startWidth = 0.14f; estela.endWidth = 0f;
            estela.sharedMaterial = chispa;
            estela.startColor = new Color(0.75f, 1f, 0.35f, 1f); estela.endColor = new Color(0.4f, 1f, 0.2f, 0f);
            Vector3 a = bocaPlanta.position, b = z.t.position + Vector3.up * 1.1f;
            float dur = 0.45f + Vector3.Distance(a, b) * 0.045f;
            for (float k = 0; k < 1; k += Time.deltaTime / dur)
            {
                if (z.t == null) break;
                b = z.t.position + Vector3.up * 1.1f;
                brote.transform.position = Vector3.Lerp(a, b, k) + Vector3.up * (Mathf.Sin(k * Mathf.PI) * 2.2f);
                brote.transform.Rotate(720 * Time.deltaTime, 0, 0);
                yield return null;
            }
            Destroy(brote, 0.3f);
            brote.GetComponent<Renderer>().enabled = false;
            if (z.t == null || z.muerto >= 0) yield break;
            Flash(b, new Color(0.65f, 1f, 0.3f), 0.5f, 26);
            z.vida--;
            if (z.vida > 0) z.a.CrossFadeInFixedTime("Dano", 0.05f);
            else { z.a.CrossFadeInFixedTime("Morir", 0.08f); z.muerto = Time.time; Flash(b, new Color(1f, 0.8f, 0.3f), 0.9f, 40); }
            yield return new WaitForSeconds(0.45f);
            if (z.muerto < 0 && z.t != null && z.t.position.z > finZ) z.a.CrossFadeInFixedTime("Andar", 0.15f);
        }

        /// <summary>Estallido de chispas (partículas) en un punto.</summary>
        void Flash(Vector3 p, Color c, float tam, int n)
        {
            var go = new GameObject("Chispas");
            go.transform.position = p;
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop();
            var m = ps.main;
            m.duration = 0.3f; m.loop = false; m.startLifetime = new ParticleSystem.MinMaxCurve(0.25f, 0.6f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(1.5f, 4.5f * tam); m.startSize = new ParticleSystem.MinMaxCurve(0.05f, 0.16f * tam);
            m.startColor = c; m.gravityModifier = 0.6f; m.simulationSpace = ParticleSystemSimulationSpace.World;
            var em = ps.emission; em.rateOverTime = 0; em.SetBursts(new[] { new ParticleSystem.Burst(0, (short)n) });
            var sh = ps.shape; sh.shapeType = ParticleSystemShapeType.Sphere; sh.radius = 0.1f;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(c, 0.3f) }, new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(0, 1) });
            col.color = g;
            var sz = ps.sizeOverLifetime; sz.enabled = true; sz.size = new ParticleSystem.MinMaxCurve(1, AnimationCurve.Linear(0, 1, 1, 0));
            go.GetComponent<ParticleSystemRenderer>().sharedMaterial = chispa;
            ps.Play();
            Destroy(go, 1.5f);
        }
    }
}
