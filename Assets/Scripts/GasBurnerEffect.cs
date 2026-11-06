using UnityEngine;

namespace ChahanGame
{
    /// <summary>
    /// 業務用バーナーの青炎・赤炎の揺らめきと鍋底ヒートグローを制御するエフェクトクラス
    /// </summary>
    public class GasBurnerEffect : MonoBehaviour
    {
        [Header("Lights")]
        [SerializeField] private Light flameLight;
        [SerializeField] private Light glowLight;

        [Header("Intensity & Flicker")]
        [SerializeField] private float baseIntensity = 1.6f;
        [SerializeField] private float flickerSpeed = 16.0f;
        [SerializeField] private float flickerAmount = 0.28f;

        [Header("Thermal Heating")]
        [SerializeField] private CookingThermodynamics cookingManager;
        [SerializeField] private MeshRenderer wokRenderer;

        private Material _wokMatInstance;
        private float _seed;

        private void Start()
        {
            _seed = Random.value * 100f;
            if (wokRenderer != null)
            {
                _wokMatInstance = wokRenderer.material;
            }
        }

        private void Update()
        {
            float t = Time.time * flickerSpeed + _seed;

            // パーリンノイズによる炎の自然な揺らめき
            float noise = Mathf.PerlinNoise(t, 0f) * 2f - 1f;
            float currentIntensity = baseIntensity + noise * flickerAmount;

            if (flameLight != null)
            {
                flameLight.intensity = currentIntensity;
            }

            // 鍋の熱量（Heat）に応じた赤熱グロー
            if (cookingManager != null && glowLight != null)
            {
                float heatNorm = Mathf.Clamp01((cookingManager.Heat - 50f) / 50f);
                glowLight.intensity = heatNorm * 2.2f + noise * 0.15f * heatNorm;
                glowLight.color = Color.Lerp(new Color(1f, 0.2f, 0f), new Color(1f, 0.45f, 0.1f), heatNorm);
            }
        }
    }
}
