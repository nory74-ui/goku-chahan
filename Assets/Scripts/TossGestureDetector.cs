using System;
using UnityEngine;

namespace ChahanGame
{
    /// <summary>
    /// 煽り動作のデータ構造
    /// </summary>
    public struct TossEventData
    {
        public float Power;          // 振りの強さ (0.5 〜 2.5)
        public float RhythmInterval; // 前回からの経過時間（秒）
        public bool IsPerfectRhythm; // プロのリズム (0.28〜0.42秒) かどうか
    }

    /// <summary>
    /// スマホ・タブレットの加速度・ジャイロを監視し、
    /// 中華鍋の「煽り（Toss）」および「皿盛り（Flip）」ジェスチャーを検出するクラス
    /// </summary>
    public class TossGestureDetector : MonoBehaviour
    {
        [Header("Toss Detection Thresholds (煽り検知感度)")]
        [Tooltip("手前に引く加速度の閾値 (Y軸)")]
        [SerializeField] private float pullYThreshold = -2.2f;

        [Tooltip("上へ持ち上げる加速度の閾値 (Z軸)")]
        [SerializeField] private float liftZThreshold = 2.0f;

        [Tooltip("手首のスナップ角速度閾値 (deg/sec)")]
        [SerializeField] private float tiltPitchThreshold = 60.0f;

        [Tooltip("連続検知を防ぐクールダウン時間（秒）")]
        [SerializeField] private float tossCooldown = 0.22f;

        [Header("Filter & Damping")]
        [Range(0.01f, 0.5f)]
        [SerializeField] private float lowPassAlpha = 0.2f;

        [Header("Flip Detection (ひっくり返し検知)")]
        [Tooltip("端末が裏返ったとみなす重力加速度の閾値")]
        [SerializeField] private float flipGravityZThreshold = 0.65f;

        // イベント
        public event Action<TossEventData> OnWokTossed;
        public event Action OnWokFlipped;

        // 内部状態
        private Vector3 _filteredAcceleration;
        private Vector3 _previousAcceleration;
        private float _lastTossTime = -1f;
        private float _lastTossInterval = 0f;
        private bool _isFlipped = false;

        private void Start()
        {
            // ジャイロセンサーを有効化
            if (SystemInfo.supportsGyroscope)
            {
                Input.gyro.enabled = true;
                Input.gyro.updateInterval = 0.016f; // 60Hz
            }
            _filteredAcceleration = Input.acceleration;
        }

        private void Update()
        {
            ProcessSensorData();

#if UNITY_EDITOR || DEVELOPMENT_BUILD
            ProcessDebugInput();
#endif
        }

        private void ProcessSensorData()
        {
            Vector3 rawAccel = Input.acceleration;

            // ローパスフィルタで高周波ノイズ（微小な手の震え）を平滑化
            _filteredAcceleration = Vector3.Lerp(_filteredAcceleration, rawAccel, lowPassAlpha);

            // 急激な加速度変化（Jerk / 躍度）を計算
            Vector3 jerk = (rawAccel - _previousAcceleration) / Mathf.Max(Time.deltaTime, 0.001f);
            _previousAcceleration = rawAccel;

            float now = Time.time;

            // 1. 煽り（Toss）の判定
            // Y軸マイナス（手前に引く）かつ Z軸プラス（上に跳ね上げる）の複合判定
            bool isPulling = rawAccel.y < pullYThreshold || jerk.y < (pullYThreshold * 3.5f);
            bool isLifting = rawAccel.z > liftZThreshold || jerk.z > (liftZThreshold * 3.5f);

            // ジャイロ角速度によるピッチ判定（手首を返したか）
            bool isPitchTilting = true;
            if (SystemInfo.supportsGyroscope)
            {
                // 手前を下げて奥を跳ね上げる回転成分
                float pitchRate = Mathf.Abs(Input.gyro.rotationRateUnbiased.x * Mathf.Rad2Deg);
                isPitchTilting = pitchRate > tiltPitchThreshold;
            }

            if (isPulling && isLifting && isPitchTilting)
            {
                if (now - _lastTossTime > tossCooldown)
                {
                    FireTossEvent(rawAccel);
                    _lastTossTime = now;
                }
            }

            // 2. 皿盛り（Flip / 端末裏返し）の判定
            // 画面を真上にして静止している時は Z ≈ -1.0G。
            // 端末をパカッと裏返して画面を下に向けると Z ≈ +1.0G に反転する。
            if (rawAccel.z > flipGravityZThreshold)
            {
                if (!_isFlipped)
                {
                    _isFlipped = true;
                    OnWokFlipped?.Invoke();
                }
            }
            else if (rawAccel.z < 0f)
            {
                _isFlipped = false;
            }
        }

        private void FireTossEvent(Vector3 accel)
        {
            float now = Time.time;
            float interval = (_lastTossTime > 0) ? (now - _lastTossTime) : 0.33f;
            _lastTossInterval = interval;

            // プロの黄金リズム: 0.28秒 〜 0.42秒 (約2.4Hz 〜 3.5Hz)
            bool isPerfectRhythm = (interval >= 0.26f && interval <= 0.44f);

            // 煽りの強さ（Intensity）を正規化
            float rawPower = (Mathf.Abs(accel.y) + Mathf.Abs(accel.z)) * 0.25f;
            float power = Mathf.Clamp(rawPower, 0.6f, 2.5f);

            var eventData = new TossEventData
            {
                Power = power,
                RhythmInterval = interval,
                IsPerfectRhythm = isPerfectRhythm
            };

            OnWokTossed?.Invoke(eventData);
        }

        private void ProcessDebugInput()
        {
            // Unityエディタでのキーボードテスト用
            if (Input.GetKeyDown(KeyCode.Space))
            {
                var eventData = new TossEventData
                {
                    Power = 1.0f,
                    RhythmInterval = 0.33f,
                    IsPerfectRhythm = true
                };
                OnWokTossed?.Invoke(eventData);
            }

            if (Input.GetKeyDown(KeyCode.F))
            {
                OnWokFlipped?.Invoke();
            }
        }
    }
}
