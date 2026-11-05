using UnityEngine;

namespace ChahanGame
{
    /// <summary>
    /// 調理の各種アクション・状態に合わせたプロシージャルサウンドを制御するマネージャー
    /// </summary>
    public class ChahanAudioManager : MonoBehaviour
    {
        [Header("Audio Clips")]
        [SerializeField] private AudioClip tossClip;
        [SerializeField] private AudioClip sizzleClip;
        [SerializeField] private AudioClip addClip;
        [SerializeField] private AudioClip soyClip;
        [SerializeField] private AudioClip platingClip;
        [SerializeField] private AudioClip wokHeiClip;

        [Header("Audio Sources")]
        [SerializeField] private AudioSource sfxSource;
        [SerializeField] private AudioSource loopSource;

        private CookingThermodynamics _cooking;

        public void Initialize(CookingThermodynamics cooking)
        {
            _cooking = cooking;

            // ループ音の設定 (炒めノイズ)
            if (loopSource != null && sizzleClip != null)
            {
                loopSource.clip = sizzleClip;
                loopSource.loop = true;
                loopSource.volume = 0f;
                loopSource.Play();
            }
        }

        private void Update()
        {
            if (_cooking == null || loopSource == null) return;

            if (_cooking.CurrentPhase == GamePhase.Cooking && _cooking.RiceTime > 0)
            {
                // 温度とパラパラ度に応じてジュージュー音の音量・ピッチを変化
                float targetVol = Mathf.Clamp01(_cooking.Heat / 80f) * 0.7f;
                loopSource.volume = Mathf.Lerp(loopSource.volume, targetVol, Time.deltaTime * 3f);
                loopSource.pitch = 0.9f + (_cooking.Heat / 100f) * 0.35f;
            }
            else
            {
                loopSource.volume = Mathf.Lerp(loopSource.volume, 0f, Time.deltaTime * 6f);
            }
        }

        public void PlayToss(float power)
        {
            if (sfxSource == null || tossClip == null) return;
            sfxSource.pitch = 0.95f + Random.Range(-0.08f, 0.08f);
            sfxSource.PlayOneShot(tossClip, Mathf.Clamp01(0.5f + power * 0.3f));
        }

        public void PlayAdd()
        {
            if (sfxSource == null || addClip == null) return;
            sfxSource.pitch = 1.0f + Random.Range(-0.1f, 0.1f);
            sfxSource.PlayOneShot(addClip, 0.8f);
        }

        public void PlaySoy()
        {
            if (sfxSource == null || soyClip == null) return;
            sfxSource.PlayOneShot(soyClip, 1.0f);
        }

        public void PlayWokHei()
        {
            if (sfxSource == null || wokHeiClip == null) return;
            sfxSource.PlayOneShot(wokHeiClip, 1.0f);
        }

        public void PlayPlating()
        {
            if (sfxSource == null || platingClip == null) return;
            sfxSource.PlayOneShot(platingClip, 1.0f);
        }
    }
}
